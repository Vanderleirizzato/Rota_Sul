import { AnimationClip, Box3, Group, Mesh, MeshStandardMaterial, Object3D, Vector3, MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as clonarComEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';

// Carrega cada modelo UMA vez e devolve cópias.
//
// Por que cache: a mesma árvore pode aparecer 500 vezes na fase. Baixar e
// decodificar o arquivo 500 vezes travaria o jogo; baixando uma vez e
// clonando, as cópias até compartilham a geometria na placa de vídeo.

interface ModeloCarregado {
  modelo: Group;
  /** Animações que vieram no arquivo (andar, acenar, bater palmas...). */
  animacoes: AnimationClip[];
}

const carregadorGltf = new GLTFLoader();
const carregadorFbx = new FBXLoader();
const cache = new Map<IdModelo, Promise<ModeloCarregado>>();

function carregar(id: IdModelo): Promise<ModeloCarregado> {
  let carregado = cache.get(id);
  if (!carregado) {
    carregado = carregarENormalizar(MODELOS[id]);
    cache.set(id, carregado);
  }
  return carregado;
}

/** Devolve uma cópia nova do modelo, já no tamanho certo e apoiada em Y = 0. */
export async function obterModelo(id: IdModelo): Promise<Group> {
  // SkeletonUtils.clone também funciona para modelos animados (com ossos),
  // onde o clone comum do three.js deixaria a malha presa ao esqueleto original.
  return clonarComEsqueleto((await carregar(id)).modelo) as Group;
}

/** As animações do modelo (as mesmas para todas as cópias). */
export async function obterAnimacoes(id: IdModelo): Promise<AnimationClip[]> {
  return (await carregar(id)).animacoes;
}

async function carregarENormalizar(info: InfoModelo): Promise<ModeloCarregado> {
  let raiz: Group;
  let animacoes: AnimationClip[];
  if (info.arquivo.toLowerCase().endsWith('.fbx')) {
    raiz = await carregadorFbx.loadAsync(info.arquivo);
    animacoes = raiz.animations;
  } else {
    const gltf = await carregadorGltf.loadAsync(info.arquivo);
    raiz = gltf.scene;
    animacoes = gltf.animations;
  }

  // O "embrulho" é um grupo limpo por fora. Toda correção (rotação, escala,
  // deslocamento) fica na `raiz` lá dentro, então quem usa o modelo pode
  // posicionar o embrulho à vontade sem desfazer a correção.
  const embrulho = new Group();
  embrulho.name = info.arquivo;
  embrulho.add(raiz);

  // 1) Rotação de correção, antes de medir.
  raiz.rotation.y = MathUtils.degToRad(info.rotacaoY);

  // 2) Escala pelo tamanho-alvo.
  const tamanho = medirCaixa(embrulho, raiz).getSize(new Vector3());
  const medidaAtual = info.medida === 'altura' ? tamanho.y : Math.max(tamanho.x, tamanho.z);
  raiz.scale.multiplyScalar(info.metros / medidaAtual);

  // 3) Centraliza em X/Z e apoia a base em Y = 0 (nada flutuando nem enterrado).
  const caixa = medirCaixa(embrulho, raiz);
  const centro = caixa.getCenter(new Vector3());
  raiz.position.x -= centro.x;
  raiz.position.z -= centro.z;
  raiz.position.y -= caixa.min.y;

  const substituto =
    info.corMaterial === undefined ? null : new MeshStandardMaterial({ color: info.corMaterial, metalness: 0.5, roughness: 0.55 });
  raiz.traverse((obj: Object3D) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (substituto) obj.material = substituto;
    }
  });
  embrulho.updateMatrixWorld(true);
  return { modelo: embrulho, animacoes };
}

function medirCaixa(embrulho: Group, raiz: Object3D): Box3 {
  embrulho.updateMatrixWorld(true);
  // `precise = true` mede os vértices de verdade, não as caixas já rotacionadas
  // de cada peça, que exageram o tamanho de modelos girados.
  return new Box3().setFromObject(raiz, true);
}
