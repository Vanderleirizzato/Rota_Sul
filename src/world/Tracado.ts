import { CatmullRomCurve3, Vector3 } from 'three';
import type { DadosPista, Lado, PontoTracado } from './levels/TiposFase';

// =============================================================================
// TRAÇADO: a linha central da estrada, já "fatiada" em pontos a cada 2 m.
// =============================================================================
// A CatmullRomCurve3 liga os pontos da fase com uma curva suave que passa
// EXATAMENTE por cada um deles (outras curvas, como a Bézier, só "puxam" na
// direção dos pontos). Mas consultar a curva matemática toda hora é caro, e
// o "t" dela não é proporcional à distância. Por isso amostramos a curva uma
// vez, em pedaços de comprimento igual, e guardamos para cada amostra:
//   - o ponto central, a direção (tangente) e o lado esquerdo;
//   - a inclinação lateral (o "banking" das curvas).
// Tudo que precisa da pista usa estas amostras: o asfalto, o terreno, as
// árvores, o reposicionamento e o cronômetro.
// =============================================================================

/** Distância entre amostras (m). Menor: curvas mais lisas, mais memória. */
const ESPACAMENTO = 2;
/** Quantas amostras de cada lado entram na média da inclinação (evita "degraus"). */
const SUAVIZACAO_INCLINACAO = 12;

/** Onde um ponto qualquer está em relação à pista. */
export interface Projecao {
  /** Amostra mais próxima. */
  indice: number;
  /** Metros desde o início do traçado. */
  distancia: number;
  /** Deslocamento lateral (m): positivo = à esquerda do centro. */
  lateral: number;
  /** Distância horizontal até a linha central (m), sempre positiva. */
  afastamento: number;
}

export class Tracado {
  readonly espacamento = ESPACAMENTO;
  readonly comprimento: number;
  readonly pontos: Vector3[];
  readonly tangentes: Vector3[];
  /** Vetor horizontal que aponta para a esquerda da estrada. */
  readonly esquerdas: Vector3[];
  /** Inclinação lateral (rad): positiva = lado esquerdo mais baixo (curva à esquerda). */
  readonly inclinacoes: number[];
  /** Meia largura do asfalto + acostamento (m): a "beira" da pista. */
  readonly meiaLarguraTotal: number;

  constructor(pontosFase: PontoTracado[], readonly pista: DadosPista) {
    const curva = new CatmullRomCurve3(
      pontosFase.map(([x, y, z]) => new Vector3(x, y, z)),
      false,
      // "centripetal" evita laços e bicos quando os pontos estão a distâncias
      // muito diferentes uns dos outros (o tipo padrão às vezes faz um nó).
      'centripetal',
    );
    this.comprimento = curva.getLength();
    const n = Math.round(this.comprimento / ESPACAMENTO);
    this.pontos = curva.getSpacedPoints(n);
    this.tangentes = this.pontos.map((_, i) => {
      const a = this.pontos[Math.max(i - 1, 0)];
      const b = this.pontos[Math.min(i + 1, n)];
      return b.clone().sub(a).normalize();
    });
    this.esquerdas = this.tangentes.map((t) => new Vector3(t.z, 0, -t.x).normalize());
    this.inclinacoes = this.calcularInclinacoes(pista);
    this.meiaLarguraTotal = pista.largura / 2 + pista.acostamento;
  }

  get quantidade(): number {
    return this.pontos.length;
  }

  /** Índice da amostra numa distância (m), limitado ao começo e fim. */
  indiceEm(distancia: number): number {
    return Math.min(Math.max(Math.round(distancia / ESPACAMENTO), 0), this.pontos.length - 1);
  }

  /** Altura da superfície da pista na amostra `i`, a `lateral` metros do centro. */
  alturaSuperficie(i: number, lateral: number): number {
    return this.pontos[i].y - lateral * Math.tan(this.inclinacoes[i]);
  }

  /** Ponto (no chão) ao lado da pista, numa distância e afastamento. */
  pontoAoLado(distancia: number, lado: Lado | 'centro', afastamento: number): Vector3 {
    const i = this.indiceEm(distancia);
    const lateral = lado === 'centro' ? 0 : lado === 'esquerda' ? afastamento : -afastamento;
    return this.pontos[i].clone().addScaledVector(this.esquerdas[i], lateral);
  }

  /**
   * Ponto exato a `distancia` metros do início, interpolando entre as duas
   * amostras vizinhas. (pontoAoLado arredonda para a amostra mais próxima,
   * o que faria quem anda devagar "pular" de 2 em 2 metros.)
   */
  posicaoEm(distancia: number, lateral: number, alvo = new Vector3()): Vector3 {
    const f = Math.min(Math.max(distancia / ESPACAMENTO, 0), this.pontos.length - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    const e = this.esquerdas[i];
    alvo.lerpVectors(this.pontos[i], this.pontos[i + 1], t);
    alvo.x += e.x * lateral;
    alvo.z += e.z * lateral;
    alvo.y = this.alturaSuperficie(i, lateral) * (1 - t) + this.alturaSuperficie(i + 1, lateral) * t;
    return alvo;
  }

  /** Ângulo em Y de quem olha na direção da pista (0 = +Z, como o carro). */
  anguloEm(i: number): number {
    const t = this.tangentes[i];
    return Math.atan2(t.x, t.z);
  }

  /**
   * Acha onde `p` está em relação à pista.
   * `dica`: índice da última projeção. O carro anda pouco entre um quadro e
   * outro, então procurar só em volta da dica é muito mais rápido que
   * comparar com todas as ~1500 amostras.
   */
  projetar(p: Vector3, dica?: number): Projecao {
    let melhor = -1;
    if (dica !== undefined) {
      melhor = this.maisProximoEntre(p, dica - 60, dica + 60);
      // Longe demais da dica (teletransporte, reposicionamento): busca geral.
      if (distanciaHorizontal(p, this.pontos[melhor]) > 40) melhor = -1;
    }
    if (melhor < 0) {
      // Busca em dois tempos: de 5 em 5 amostras, depois refina em volta.
      const grosso = this.maisProximoEntre(p, 0, this.pontos.length - 1, 5);
      melhor = this.maisProximoEntre(p, grosso - 5, grosso + 5);
    }
    const c = this.pontos[melhor];
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const t = this.tangentes[melhor];
    const e = this.esquerdas[melhor];
    const lateral = dx * e.x + dz * e.z;
    return {
      indice: melhor,
      distancia: melhor * ESPACAMENTO + dx * t.x + dz * t.z,
      lateral,
      afastamento: Math.abs(lateral),
    };
  }

  private maisProximoEntre(p: Vector3, de: number, ate: number, passo = 1): number {
    const inicio = Math.max(de, 0);
    const fim = Math.min(ate, this.pontos.length - 1);
    let melhor = inicio;
    let menor = Infinity;
    for (let i = inicio; i <= fim; i += passo) {
      const d = distanciaHorizontalQuadrada(p, this.pontos[i]);
      if (d < menor) {
        menor = d;
        melhor = i;
      }
    }
    return melhor;
  }

  /**
   * Curva fechada = mais inclinação, como nas estradas de verdade: a pista
   * "deita" para dentro e ajuda o carro a fazer a curva.
   */
  private calcularInclinacoes(pista: DadosPista): number[] {
    const maxima = (pista.inclinacaoMaximaGraus * Math.PI) / 180;
    const n = this.pontos.length;
    const brutas = this.pontos.map((_, i) => {
      if (i === 0 || i === n - 1) return 0;
      // Curvatura = quanto a direção muda por metro (1 / raio).
      // Positiva quando a pista vira para a esquerda.
      const mudanca = this.tangentes[i + 1].clone().sub(this.tangentes[i - 1]);
      const curvatura = mudanca.dot(this.esquerdas[i]) / (2 * ESPACAMENTO);
      const fracao = Math.min(Math.abs(curvatura) * pista.raioInclinacaoTotal, 1);
      return Math.sign(curvatura) * maxima * fracao;
    });
    // Média móvel: a inclinação entra e sai da curva aos poucos.
    return brutas.map((_, i) => {
      let soma = 0;
      let conta = 0;
      for (let j = i - SUAVIZACAO_INCLINACAO; j <= i + SUAVIZACAO_INCLINACAO; j++) {
        if (j < 0 || j >= n) continue;
        soma += brutas[j];
        conta++;
      }
      return soma / conta;
    });
  }
}

function distanciaHorizontalQuadrada(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function distanciaHorizontal(a: Vector3, b: Vector3): number {
  return Math.sqrt(distanciaHorizontalQuadrada(a, b));
}
