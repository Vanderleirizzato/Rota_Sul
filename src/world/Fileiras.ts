import {
  Box3,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';
import { CAMADA_BRILHO } from '../graphics/Camadas';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { obterModelo } from './CarregadorModelos';
import { criarInstancias } from './Instancias';
import type { FileiraFase } from './levels/TiposFase';
import { criarSorteio } from './Ruido';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// FILEIRAS: objetos repetidos ao longo da pista (ver FileiraFase em TiposFase).
// =============================================================================
// Uma orla tem centenas de coqueiros, postes e prédios. Cada um como objeto
// separado custaria uma "chamada de desenho" por malha: o jogo travaria.
// Por isso todos os iguais viram UM InstancedMesh (a placa de vídeo desenha
// todos de uma vez), e a física ganha só formas simples: caixa ou cilindro.
// =============================================================================

const EIXO_Y = new Vector3(0, 1, 0);
/** Raio (m) da bolinha que brilha na lâmpada dos postes acesos. */
const RAIO_LAMPADA = 0.3;
/** Cor da luz dos postes (amarelo quente, de lâmpada de rua). */
const COR_LAMPADA = 0xffd9a0;

/** Tamanho (m) de cada modelo, medido uma vez. */
type Medidas = Map<IdModelo, Vector3>;

export async function colocarFileiras(
  cena: Scene,
  fisica: MundoFisico,
  tracado: Tracado,
  terreno: Terreno,
  fileiras: readonly FileiraFase[],
): Promise<void> {
  if (fileiras.length === 0) return;
  const ids = [...new Set(fileiras.flatMap((f) => f.modelos))];
  const modelos = new Map(await Promise.all(ids.map(async (id) => [id, await obterModelo(id)] as const)));
  const medidas: Medidas = new Map(ids.map((id) => [id, new Box3().setFromObject(modelos.get(id)!).getSize(new Vector3())]));

  // Semente fixa: a mesma fase tem sempre a mesma cidade.
  const sorteio = criarSorteio(4242);
  const matrizes = new Map<IdModelo, Matrix4[]>(ids.map((id) => [id, []]));
  const lampadas: Vector3[] = [];

  for (const f of fileiras) {
    for (let d = f.inicio; d <= f.fim; d += f.espacamento) {
      if (f.vaos?.some(([a, b]) => d >= a && d <= b)) continue;
      if (f.falhas && sorteio() < f.falhas) continue;
      colocarUm(f, d);
    }
  }

  for (const [id, lista] of matrizes) criarInstancias(cena, modelos.get(id)!, lista);
  if (lampadas.length > 0) cena.add(criarLampadas(lampadas));

  /** Um objeto (ou uma pilha deles) na distância `d` da fileira `f`. */
  function colocarUm(f: FileiraFase, d: number): void {
    const variar = (quanto = 0): number => (sorteio() * 2 - 1) * quanto;
    const afastamento = f.afastamento + variar(f.variacaoAfastamento);
    const base = tracado.pontoAoLado(d, f.lado, afastamento);
    base.y = terreno.alturaEm(base.x, base.z);

    // De frente para a pista (mesma regra do ObjetosFase), mais a rotação pedida.
    const i = tracado.indiceEm(d);
    const e = tracado.esquerdas[i];
    const paraPista = f.lado === 'esquerda' ? -1 : 1;
    const angulo = Math.atan2(e.x * paraPista, e.z * paraPista) + MathUtils.degToRad((f.rotacao ?? 0) + variar(f.variacaoRotacao));
    const giro = new Quaternion().setFromAxisAngle(EIXO_Y, angulo);
    const [min, max] = f.escala ?? [1, 1];
    const escala = min + sorteio() * (max - min);

    // Pilha: cada andar sorteia seu modelo (contêineres de cores diferentes).
    const andares = f.pilha ? f.pilha[0] + Math.floor(sorteio() * (f.pilha[1] - f.pilha[0] + 1)) : 1;
    let altura = 0;
    let largura = 0;
    let profundidade = 0;
    let primeiro: IdModelo = f.modelos[0];
    for (let k = 0; k < andares; k++) {
      const id = f.modelos[Math.floor(sorteio() * f.modelos.length)];
      if (k === 0) primeiro = id;
      const tamanho = medidas.get(id)!.clone().multiplyScalar(escala);
      const posicao = base.clone().setY(base.y + altura);
      matrizes.get(id)!.push(new Matrix4().compose(posicao, giro, new Vector3(escala, escala, escala)));
      altura += tamanho.y;
      largura = Math.max(largura, tamanho.x);
      profundidade = Math.max(profundidade, tamanho.z);
    }

    if (f.colisor === 'caixa') {
      fisica.criarCaixaFixa({ x: base.x, y: base.y + altura / 2, z: base.z }, largura / 2, altura / 2, profundidade / 2, giro);
    } else if (f.colisor === 'tronco') {
      fisica.criarCilindroFixo({ x: base.x, y: base.y + altura / 2, z: base.z }, (f.raioTronco ?? 0.2) * escala, altura / 2);
    }

    const info: InfoModelo = MODELOS[primeiro];
    if (f.acesa && info.lampada) {
      lampadas.push(new Vector3(...info.lampada).multiplyScalar(escala).applyQuaternion(giro).add(base));
    }
  }
}

/**
 * As lâmpadas são bolinhas de cor forte na camada de BRILHO: o bloom faz o
 * "halo" em volta delas. Luz de verdade (PointLight) em cada poste seria
 * pesada demais: cada luz a mais encarece TODOS os materiais da cena.
 */
function criarLampadas(posicoes: Vector3[]): InstancedMesh {
  const malha = new InstancedMesh(
    new SphereGeometry(RAIO_LAMPADA, 10, 8),
    // toneMapped: false deixa a cor "estourar" acima do branco, como uma lâmpada.
    new MeshBasicMaterial({ color: COR_LAMPADA, toneMapped: false }),
    posicoes.length,
  );
  const m = new Matrix4();
  posicoes.forEach((p, k) => malha.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z)));
  malha.computeBoundingSphere();
  malha.layers.enable(CAMADA_BRILHO);
  return malha;
}
