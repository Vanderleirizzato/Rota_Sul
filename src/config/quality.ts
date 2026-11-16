// =============================================================================
// QUALIDADE GRÁFICA
// =============================================================================
// Quatro níveis prontos. No PC o jogo começa no Médio; no celular, no
// Celular. A meta do Baixo é 60 fps em notebook com vídeo integrado; o Alto
// é para placa de vídeo dedicada.
//
// O que mais pesa, em ordem: resolução (pixel ratio), vegetação (árvores
// detalhadas e a sombra delas), sombras, bloom e SMAA.
// =============================================================================

/** Do mais leve ao mais pesado: é a ordem em que o menu passa por eles. */
export const NIVEIS_QUALIDADE = ['celular', 'baixo', 'medio', 'alto'] as const;
export type NivelQualidade = (typeof NIVEIS_QUALIDADE)[number];

export interface ConfigQualidade {
  nome: string;
  /** Para quem é este nível (aparece no menu, embaixo do nome). */
  descricao: string;
  /** Multiplicador máximo de resolução. 1 = um pixel de jogo por pixel de tela
   *  "lógico"; 2 = nitidez de tela retina, com 4 vezes mais trabalho. */
  pixelRatioMaximo: number;
  /** Fração da resolução usada para desenhar (1 = resolução cheia). Abaixo de 1
   *  a imagem fica um pouco mais "macia", mas a placa de vídeo trabalha bem
   *  menos: 0,75 desenha só 56% dos pixels. É o ajuste que mais ajuda vídeo integrado. */
  escalaResolucao: number;
  /** Sombras dinâmicas ligadas? */
  sombras: boolean;
  /** Resolução do mapa de sombra (px). Maior: sombra mais nítida e mais cara. */
  tamanhoSombra: number;
  /** Lado da área com sombra em volta do carro (m). */
  areaSombra: number;
  /** Brilho estourado em luzes fortes (faróis, chamas do nitro, sol). */
  bloom: boolean;
  /** Antisserrilhado das bordas (SMAA). */
  smaa: boolean;
  /** Até onde enxergamos (m). Além disso, a neblina esconde e nada é desenhado. */
  distanciaDesenho: number;
  /**
   * Mostra as árvores muito detalhadas (árvore grande, árvore com cipós:
   * 35 a 53 mil triângulos CADA). Desligado, ficam só as árvores comuns.
   */
  arvoresDetalhadas: boolean;
  /**
   * Plantas e pessoas projetam sombra? Tudo que tem sombra é desenhado duas
   * vezes (uma para a tela, outra para o mapa de sombra). O carro, as pedras
   * e os objetos da fase continuam com sombra sempre.
   */
  sombraCenario: boolean;
}

export const QUALIDADES: Record<NivelQualidade, ConfigQualidade> = {
  // Celular: a placa de vídeo é bem mais fraca que a de um notebook, e ela
  // esquenta (e o celular diminui a velocidade sozinho para esfriar). Por
  // isso cortamos o que mais pesa: sombras (desenhar a cena duas vezes) e
  // a quantidade de pixels. A tela é pequena, então a perda quase não aparece.
  celular: {
    nome: 'Celular',
    descricao: 'Celular e tablet: sem sombras, enxerga mais perto',
    pixelRatioMaximo: 1,
    escalaResolucao: 0.7,
    sombras: false,
    // Sem sombras, estes dois não são usados; ficam pequenos caso alguém ligue as sombras.
    tamanhoSombra: 512,
    areaSombra: 30,
    bloom: false,
    smaa: false,
    distanciaDesenho: 220,
    arvoresDetalhadas: false,
    sombraCenario: false,
  },
  baixo: {
    nome: 'Baixo',
    descricao: 'Notebook com vídeo integrado',
    pixelRatioMaximo: 1,
    escalaResolucao: 0.75,
    sombras: true,
    tamanhoSombra: 1024,
    areaSombra: 35,
    bloom: false,
    smaa: false,
    distanciaDesenho: 320,
    arvoresDetalhadas: false,
    sombraCenario: false,
  },
  medio: {
    nome: 'Médio',
    descricao: 'Computador comum',
    pixelRatioMaximo: 1.5,
    escalaResolucao: 1,
    sombras: true,
    tamanhoSombra: 2048,
    areaSombra: 50,
    bloom: true,
    smaa: true,
    distanciaDesenho: 700,
    arvoresDetalhadas: true,
    sombraCenario: true,
  },
  alto: {
    nome: 'Alto',
    descricao: 'Placa de vídeo dedicada',
    // Limite do CLAUDE.md: nunca acima de 2.
    pixelRatioMaximo: 2,
    escalaResolucao: 1,
    sombras: true,
    tamanhoSombra: 4096,
    areaSombra: 70,
    bloom: true,
    smaa: true,
    distanciaDesenho: 1200,
    arvoresDetalhadas: true,
    sombraCenario: true,
  },
};

export const QUALIDADE_PADRAO: NivelQualidade = 'medio';
