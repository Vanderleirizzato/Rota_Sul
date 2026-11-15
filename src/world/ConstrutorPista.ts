import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Scene,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { texturaAsfalto } from '../graphics/Texturas';
import type { Tracado } from './Tracado';

// =============================================================================
// CONSTRUTOR DE PISTA: transforma o traçado em estrada.
// =============================================================================
// Para cada amostra do traçado (a cada 2 m), criamos pontos atravessando a
// estrada da esquerda para a direita e ligamos amostras vizinhas com
// triângulos, como os degraus de uma escada. A altura de cada ponto já
// inclui a inclinação lateral da curva (Tracado.alturaSuperficie).
//
// A mesma "escada" vira três coisas:
//   - a malha visível do asfalto e dos acostamentos;
//   - a pintura (faixas finas um fio acima do asfalto);
//   - o colisor físico (em que as rodas do carro encostam).
// =============================================================================

/** Repetição da textura de asfalto (m). */
const TAMANHO_TEXTURA = 8;
/** Altura da pintura acima do asfalto (m): um fio, só para não piscar. */
const ALTURA_TINTA = 0.015;
/**
 * "Saia" que desce da beira do acostamento até o chão, tapando a fresta.
 * Ela também faz parte do colisor: é a rampa por onde o carro volta da grama
 * para o asfalto. Larga e suave (uns 15°), para a roda subir sem bater numa
 * "guia" de calçada.
 */
const SAIA = { largura: 3, queda: 0.8 };
/** Faixas pintadas (m). */
const LINHA_BORDA = { largura: 0.2, recuo: 0.25 };
const LINHA_CENTRO = { largura: 0.15, pintado: 4, vazio: 6, separacaoDupla: 0.35 };
/** Acima desta fração da inclinação máxima, a curva ganha faixa dupla contínua (proibido ultrapassar). */
const CURVA_PROIBIDA = 0.35;
/** Paredes invisíveis nas pontas da pista: altura (m) e folga lateral além da beira. */
const PAREDE_PONTA = { altura: 4, folga: 12 };

/** Junta triângulos de várias faixas numa malha só (uma chamada de desenho). */
class Acumulador {
  readonly posicoes: number[] = [];
  readonly uvs: number[] = [];

  constructor(private readonly tracado: Tracado) {}

  /**
   * Faixa ao longo da pista, das amostras i0 a i1, entre duas posições
   * laterais (m, positivo = esquerda). `quedaA/B` abaixa cada borda.
   */
  faixa(i0: number, i1: number, lateralA: number, lateralB: number, elevacao: number, quedaA = 0, quedaB = 0): void {
    const t = this.tracado;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const d = new Vector3();
    for (let i = i0; i < i1; i++) {
      this.ponto(a, i, lateralA, elevacao - quedaA);
      this.ponto(b, i, lateralB, elevacao - quedaB);
      this.ponto(c, i + 1, lateralA, elevacao - quedaA);
      this.ponto(d, i + 1, lateralB, elevacao - quedaB);
      const v0 = (i * t.espacamento) / TAMANHO_TEXTURA;
      const v1 = ((i + 1) * t.espacamento) / TAMANHO_TEXTURA;
      const uA = lateralA / TAMANHO_TEXTURA;
      const uB = lateralB / TAMANHO_TEXTURA;
      // p/r = borda esquerda (agora e na próxima amostra), q/s = borda direita.
      // A ordem p→q→r gira no sentido anti-horário visto de cima: é isso que
      // faz a face "apontar" para cima (o three só desenha o lado da frente).
      const [p, q, r, s, ua, ub] = lateralA > lateralB ? [a, b, c, d, uA, uB] : [b, a, d, c, uB, uA];
      this.posicoes.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, q.x, q.y, q.z, s.x, s.y, s.z, r.x, r.y, r.z);
      this.uvs.push(ua, v0, ub, v0, ua, v1, ub, v0, ub, v1, ua, v1);
    }
  }

  private ponto(alvo: Vector3, i: number, lateral: number, elevacao: number): void {
    const t = this.tracado;
    const p = t.pontos[i];
    const e = t.esquerdas[i];
    alvo.set(p.x + e.x * lateral, t.alturaSuperficie(i, lateral) + elevacao, p.z + e.z * lateral);
  }

  criarMalha(material: Material): Mesh {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(this.posicoes, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    geo.computeVertexNormals();
    const malha = new Mesh(geo, material);
    malha.receiveShadow = true;
    return malha;
  }
}

/** Material de tinta: polygonOffset puxa a tinta "para a frente" e evita que ela pisque com o asfalto. */
function tinta(cor: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: cor, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

export function construirPista(cena: Scene, fisica: MundoFisico, tracado: Tracado, largada: number, chegada: number): void {
  const fim = tracado.quantidade - 1;
  const meiaAsfalto = tracado.pista.largura / 2;
  const borda = tracado.meiaLarguraTotal;

  // --- asfalto e acostamentos ---------------------------------------------
  const textura = texturaAsfalto();
  const asfalto = new Acumulador(tracado);
  asfalto.faixa(0, fim, meiaAsfalto, -meiaAsfalto, 0);
  cena.add(asfalto.criarMalha(new MeshStandardMaterial({ map: textura, roughness: 0.92 })));

  const acostamento = new Acumulador(tracado);
  acostamento.faixa(0, fim, borda, meiaAsfalto, 0);
  acostamento.faixa(0, fim, -meiaAsfalto, -borda, 0);
  acostamento.faixa(0, fim, borda + SAIA.largura, borda, 0, SAIA.queda, 0);
  acostamento.faixa(0, fim, -borda, -borda - SAIA.largura, 0, 0, SAIA.queda);
  // Mesmo asfalto, mais claro e gasto: o jogador vê onde a pista "acaba".
  cena.add(acostamento.criarMalha(new MeshStandardMaterial({ map: textura, color: 0xa39a8c, roughness: 0.95 })));

  // --- pintura ---------------------------------------------------------------
  const brancas = new Acumulador(tracado);
  const lb = meiaAsfalto - LINHA_BORDA.recuo;
  brancas.faixa(0, fim, lb, lb - LINHA_BORDA.largura, ALTURA_TINTA);
  brancas.faixa(0, fim, -lb + LINHA_BORDA.largura, -lb, ALTURA_TINTA);
  xadrez(brancas, tracado, largada, meiaAsfalto);
  xadrez(brancas, tracado, chegada, meiaAsfalto);
  cena.add(brancas.criarMalha(tinta(0xf2f2f2)));
  cena.add(faixaCentral(tracado, fim).criarMalha(tinta(0xf2c230)));

  // --- física ----------------------------------------------------------------
  // O colisor cobre asfalto + acostamentos + saias. Só as bordas bastam: a
  // superfície atravessando a pista é plana (inclinada, mas reta).
  const colisor = new Acumulador(tracado);
  colisor.faixa(0, fim, borda + SAIA.largura, borda, 0, SAIA.queda, 0);
  colisor.faixa(0, fim, borda, -borda, 0);
  colisor.faixa(0, fim, -borda, -borda - SAIA.largura, 0, 0, SAIA.queda);
  fisica.criarMalhaFixa(new Float32Array(colisor.posicoes), sequencia(colisor.posicoes.length / 3), 0.9);

  // Paredes invisíveis nas duas pontas: a pista é linear, não tem "depois".
  paredeNaPonta(fisica, tracado, 0, -1);
  paredeNaPonta(fisica, tracado, fim, 1);
}

/** Faixa amarela do meio: tracejada nas retas, dupla e contínua nas curvas. */
function faixaCentral(tracado: Tracado, fim: number): Acumulador {
  const amarelas = new Acumulador(tracado);
  const maxima = (tracado.pista.inclinacaoMaximaGraus * Math.PI) / 180;
  const meia = LINHA_CENTRO.largura / 2;
  const sep = LINHA_CENTRO.separacaoDupla / 2;
  const ciclo = LINHA_CENTRO.pintado + LINHA_CENTRO.vazio;
  for (let i = 0; i < fim; i++) {
    const emCurva = Math.abs(tracado.inclinacoes[i]) > maxima * CURVA_PROIBIDA;
    if (emCurva) {
      amarelas.faixa(i, i + 1, sep + meia, sep - meia, ALTURA_TINTA);
      amarelas.faixa(i, i + 1, -sep + meia, -sep - meia, ALTURA_TINTA);
    } else if ((i * tracado.espacamento) % ciclo < LINHA_CENTRO.pintado) {
      amarelas.faixa(i, i + 1, meia, -meia, ALTURA_TINTA);
    }
  }
  return amarelas;
}

/** Faixa quadriculada atravessando o asfalto (largada e chegada). */
function xadrez(acumulador: Acumulador, tracado: Tracado, distancia: number, meiaAsfalto: number): void {
  const i = tracado.indiceEm(distancia);
  const lado = 1; // casas de 1 m
  const colunas = Math.floor((meiaAsfalto * 2) / lado);
  // Cada linha do xadrez ocupa uma amostra (2 m); usamos 2 linhas.
  for (let linha = 0; linha < 2; linha++) {
    for (let c = 0; c < colunas; c++) {
      if ((c + linha) % 2) continue;
      const esquerda = meiaAsfalto - c * lado;
      acumulador.faixa(i + linha, i + linha + 1, esquerda, esquerda - lado, ALTURA_TINTA);
    }
  }
}

function paredeNaPonta(fisica: MundoFisico, tracado: Tracado, i: number, sentido: 1 | -1): void {
  const p = tracado.pontos[i];
  const t = tracado.tangentes[i];
  const centro = p.clone().addScaledVector(t, sentido * 1.5).setY(p.y + PAREDE_PONTA.altura / 2 - 1);
  const rotacao = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tracado.anguloEm(i));
  const meiaLargura = tracado.meiaLarguraTotal + PAREDE_PONTA.folga;
  fisica.criarCaixaFixa(centro, meiaLargura, PAREDE_PONTA.altura / 2, 1, rotacao);
}

function sequencia(n: number): Uint32Array {
  const indices = new Uint32Array(n);
  for (let k = 0; k < n; k++) indices[k] = k;
  return indices;
}
