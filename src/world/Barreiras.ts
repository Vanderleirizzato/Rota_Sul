import { Box3, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { obterModelo } from './CarregadorModelos';
import { criarInstancias } from './Instancias';
import type { BarreiraFase } from './levels/TiposFase';
import type { Tracado } from './Tracado';

// =============================================================================
// BARREIRAS FIXAS nas curvas perigosas.
// =============================================================================
// O desenho são várias peças iguais, uma do lado da outra (InstancedMesh).
// Mas a FÍSICA não usa uma caixa por peça: o carro raspando numa fileira de
// caixas "tropeça" na emenda entre elas e pode girar ou capotar. Em vez
// disso, a barreira inteira vira UM muro contínuo (malha de triângulos) que
// acompanha a curva: o carro bate e desliza, como num guard-rail de verdade.
// =============================================================================

/** Espaço (m) entre a beira do acostamento e a barreira. */
const RECUO = 0.4;
/** De quantos em quantos metros o muro invisível é medido ao longo da curva. */
const PASSO_MURO = 2;
/** O muro sai um pouco do chão para baixo (assim não fica fresta no barranco). */
const ENTERRAR = 0.6;
/** Altura mínima do muro (m): mais baixo que isso, o carro "sobe" na barreira. */
const ALTURA_MINIMA = 0.95;
const EIXO_Y = new Vector3(0, 1, 0);

export async function colocarBarreiras(cena: Scene, fisica: MundoFisico, tracado: Tracado, barreiras: readonly BarreiraFase[]): Promise<void> {
  const ids = [...new Set(barreiras.map((b) => b.modelo))];
  for (const id of ids) {
    const modelo = await obterModelo(id);
    const tamanho = new Box3().setFromObject(modelo).getSize(new Vector3());
    const matrizes: Matrix4[] = [];
    for (const b of barreiras.filter((x) => x.modelo === id)) {
      matrizes.push(...pecas(tracado, b, tamanho));
      criarMuro(fisica, tracado, b, tamanho);
    }
    criarInstancias(cena, modelo, matrizes);
  }
}

/** Posição de cada peça: uma encostada na outra, de frente para a pista. */
function pecas(tracado: Tracado, b: BarreiraFase, tamanho: Vector3): Matrix4[] {
  const sinal = b.lado === 'esquerda' ? 1 : -1;
  const lateral = sinal * (tracado.meiaLarguraTotal + RECUO + tamanho.z / 2);
  const comprimento = Math.max(tamanho.x, 0.5);
  const lista: Matrix4[] = [];
  for (let d = b.inicio; d <= b.fim; d += comprimento) {
    const i = tracado.indiceEm(d);
    const pos = tracado.posicaoEm(d, lateral);
    // Altura da beira do asfalto: depois dela o chão cai (a "saia" da pista).
    pos.y = tracado.posicaoEm(d, sinal * tracado.meiaLarguraTotal).y - 0.05;
    const e = tracado.esquerdas[i];
    const angulo = Math.atan2(-sinal * e.x, -sinal * e.z);
    lista.push(new Matrix4().compose(pos, new Quaternion().setFromAxisAngle(EIXO_Y, angulo), new Vector3(1, 1, 1)));
  }
  return lista;
}

/**
 * O muro invisível: um "tubo" de seção retangular ao longo da curva, fechado
 * nas pontas. Cada face é montada com os triângulos virados para FORA (o
 * Rapier usa esse lado para saber de onde vem a batida).
 */
function criarMuro(fisica: MundoFisico, tracado: Tracado, b: BarreiraFase, tamanho: Vector3): void {
  const sinal = b.lado === 'esquerda' ? 1 : -1;
  const dentro = sinal * (tracado.meiaLarguraTotal + RECUO);
  const fora = sinal * (tracado.meiaLarguraTotal + RECUO + Math.max(tamanho.z, 0.4));
  const altura = Math.max(tamanho.y, ALTURA_MINIMA);

  const vertices: number[] = [];
  const indices: number[] = [];
  // Cada seção tem 4 cantos: 0 dentro-baixo, 1 dentro-cima, 2 fora-cima, 3 fora-baixo.
  const secoes: Vector3[][] = [];
  const passos = Math.max(1, Math.ceil((b.fim - b.inicio) / PASSO_MURO));
  for (let k = 0; k <= passos; k++) {
    const d = b.inicio + ((b.fim - b.inicio) * k) / passos;
    const chao = tracado.posicaoEm(d, sinal * tracado.meiaLarguraTotal).y;
    const a = tracado.posicaoEm(d, dentro).setY(chao - ENTERRAR);
    const c = tracado.posicaoEm(d, fora).setY(chao - ENTERRAR);
    secoes.push([a, a.clone().setY(chao + altura), c.clone().setY(chao + altura), c]);
  }
  const indice = (p: Vector3): number => {
    vertices.push(p.x, p.y, p.z);
    return vertices.length / 3 - 1;
  };
  /** Quadrilátero a-b-c-d com a frente virada para `direcao`. */
  const quad = (a: Vector3, b2: Vector3, c: Vector3, d: Vector3, direcao: Vector3): void => {
    const normal = new Vector3().crossVectors(b2.clone().sub(a), c.clone().sub(a));
    const [ia, ib, ic, id] = [a, b2, c, d].map(indice);
    if (normal.dot(direcao) >= 0) indices.push(ia, ib, ic, ia, ic, id);
    else indices.push(ia, ic, ib, ia, id, ic);
  };

  for (let k = 0; k < secoes.length - 1; k++) {
    const [s, n] = [secoes[k], secoes[k + 1]];
    const i = tracado.indiceEm(b.inicio + ((b.fim - b.inicio) * k) / passos);
    const paraPista = tracado.esquerdas[i].clone().multiplyScalar(-sinal);
    quad(s[0], n[0], n[1], s[1], paraPista); // face virada para a pista
    quad(s[1], n[1], n[2], s[2], EIXO_Y); // topo
    quad(s[2], n[2], n[3], s[3], paraPista.clone().negate()); // face de trás
    quad(s[3], n[3], n[0], s[0], EIXO_Y.clone().negate()); // fundo
  }
  // Tampas das duas pontas.
  const ultimo = secoes.length - 1;
  const iniT = tracado.tangentes[tracado.indiceEm(b.inicio)];
  const fimT = tracado.tangentes[tracado.indiceEm(b.fim)];
  const [p0, p1] = [secoes[0], secoes[ultimo]];
  quad(p0[0], p0[1], p0[2], p0[3], iniT.clone().negate());
  quad(p1[0], p1[1], p1[2], p1[3], fimT);

  fisica.criarMalhaFixa(new Float32Array(vertices), new Uint32Array(indices), 0.3);
}
