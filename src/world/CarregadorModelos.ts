import { Box3, Group, Mesh, Object3D, Vector3, MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarComEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';

// Carrega cada .glb UMA vez e devolve cópias.
//
// Por que cache: a mesma árvore pode aparecer 500 vezes na fase. Baixar e
// decodificar o arquivo 500 vezes travaria o jogo; baixando uma vez e
// clonando, as cópias até compartilham a geometria na placa de vídeo.

const carregador = new GLTFLoader();
const cache = new Map<IdModelo, Promise<Group>>();

/** Devolve uma cópia nova do modelo, já no tamanho certo e apoiada em Y = 0. */
export async function obterModelo(id: IdModelo): Promise<Group> {
  let modelo = cache.get(id);
  if (!modelo) {
    modelo = carregarENormalizar(MODELOS[id]);
    cache.set(id, modelo);
  }
  // SkeletonUtils.clone também funciona para modelos animados (com ossos),
  // onde o clone comum do three.js deixaria a malha presa ao esqueleto original.
  return clonarComEsqueleto(await modelo) as Group;
}

async function carregarENormalizar(info: InfoModelo): Promise<Group> {
  const gltf = await carregador.loadAsync(info.arquivo);
  const raiz = gltf.scene;

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

  raiz.traverse((obj: Object3D) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  embrulho.updateMatrixWorld(true);
  return embrulho;
}

function medirCaixa(embrulho: Group, raiz: Object3D): Box3 {
  embrulho.updateMatrixWorld(true);
  // `precise = true` mede os vértices de verdade, não as caixas já rotacionadas
  // de cada peça, que exageram o tamanho de modelos girados.
  return new Box3().setFromObject(raiz, true);
}
