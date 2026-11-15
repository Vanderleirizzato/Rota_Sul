// =============================================================================
// QUALIDADE GRÁFICA
// =============================================================================
// Três níveis prontos. O jogo começa no Médio. A meta do Baixo é 60 fps em
// notebook com vídeo integrado; o Alto é para placa de vídeo dedicada.
//
// O que mais pesa, em ordem: resolução (pixel ratio), sombras, bloom e SMAA.
// =============================================================================

export type NivelQualidade = 'baixo' | 'medio' | 'alto';

export interface ConfigQualidade {
  nome: string;
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
}

export const QUALIDADES: Record<NivelQualidade, ConfigQualidade> = {
  baixo: {
    nome: 'Baixo',
    pixelRatioMaximo: 1,
    escalaResolucao: 0.75,
    sombras: true,
    tamanhoSombra: 1024,
    areaSombra: 35,
    bloom: false,
    smaa: false,
    distanciaDesenho: 400,
  },
  medio: {
    nome: 'Médio',
    pixelRatioMaximo: 1.5,
    escalaResolucao: 1,
    sombras: true,
    tamanhoSombra: 2048,
    areaSombra: 50,
    bloom: true,
    smaa: true,
    distanciaDesenho: 700,
  },
  alto: {
    nome: 'Alto',
    // Limite do CLAUDE.md: nunca acima de 2.
    pixelRatioMaximo: 2,
    escalaResolucao: 1,
    sombras: true,
    tamanhoSombra: 4096,
    areaSombra: 70,
    bloom: true,
    smaa: true,
    distanciaDesenho: 1200,
  },
};

export const QUALIDADE_PADRAO: NivelQualidade = 'medio';
