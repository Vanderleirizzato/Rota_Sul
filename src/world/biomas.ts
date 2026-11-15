import type { IdModelo } from './assets';

// =============================================================================
// BIOMAS: a "cara" do terreno e da vegetação em volta da pista.
// =============================================================================
// Separado das fases porque várias fases podem usar o mesmo bioma (a mata da
// Fase 1 pode voltar numa fase de serra no meio do caminho, por exemplo).
//
// Quantidades são "por km de pista", somando os dois lados: assim uma pista
// mais comprida ganha mais árvores sem ninguém precisar recalcular.
// =============================================================================

/** Vegetação feita com um modelo .glb (detalhada, perto da pista). */
export interface PlantaModelo {
  modelo: IdModelo;
  porKm: number;
  /** Variação de tamanho: multiplicador sorteado entre os dois valores. */
  escala: [min: number, max: number];
  /**
   * Raio (m) do cilindro que o carro não atravessa (o tronco, ou a pedra
   * inteira). Sem este campo, a planta não tem colisor (moitas, folhagem).
   */
  raioColisor?: number;
  /** Modelo muito detalhado: some na qualidade Baixa (ver quality.ts). */
  pesada?: boolean;
}

export interface ConfigBioma {
  terreno: {
    /** Cores em hexadecimal. A grama alterna entre as duas pelo ruído. */
    corGrama: number;
    corGramaEscura: number;
    /** Faixa de chão logo depois do acostamento. */
    corTerra: number;
    /** Encostas íngremes viram pedra. */
    corRocha: number;
    /** Altura típica dos morros (m). Mais alto: vale mais fechado. */
    alturaMorros: number;
    /** Tamanho típico de um morro (m). Mais alto: morros mais largos e suaves. */
    larguraMorros: number;
    /** Quanto o terreno sobe a cada metro, longe da pista (cria as montanhas do fundo). */
    subidaAoLonge: number;
    /** Muda o sorteio do relevo. Outro número = outros morros. */
    semente: number;
  };
  /**
   * Faixa (m, a partir da beira do acostamento) onde ficam as plantas
   * detalhadas. Modelos pesados só perto da pista, onde dá para vê-los bem.
   */
  faixaPerto: [inicio: number, fim: number];
  plantasPerto: PlantaModelo[];
  /**
   * Árvores "leves" (geradas por código, ~40 triângulos cada) para o fundo.
   * Ao longe ninguém nota a diferença, e cada uma custa 100× menos que um .glb.
   */
  arvoresLonge: {
    porKm: number;
    faixa: [inicio: number, fim: number];
    corCopa: number;
    corTronco: number;
  };
  /** Pedras soltas perto da pista (dê um raioColisor: são sólidas). */
  pedras: PlantaModelo[];
}

export const BIOMAS = {
  // Mata Atlântica de Foz: verde intenso e terra vermelha (a "terra roxa" do Paraná).
  mataAtlantica: {
    terreno: {
      corGrama: 0x3f7a2a,
      corGramaEscura: 0x2a5a1f,
      corTerra: 0x8a3f22,
      corRocha: 0x6e6457,
      alturaMorros: 28,
      larguraMorros: 140,
      subidaAoLonge: 0.18,
      semente: 7,
    },
    faixaPerto: [5, 32],
    plantasPerto: [
      { modelo: 'arvore', porKm: 90, escala: [0.8, 1.3], raioColisor: 0.35 },
      { modelo: 'arvoreGrande', porKm: 6, escala: [0.85, 1.15], raioColisor: 1.0, pesada: true },
      { modelo: 'arvoreCipo', porKm: 4, escala: [0.9, 1.2], raioColisor: 0.8, pesada: true },
    ],
    arvoresLonge: { porKm: 700, faixa: [28, 260], corCopa: 0x2f6a24, corTronco: 0x4a3524 },
    pedras: [
      { modelo: 'rochaMedia', porKm: 10, escala: [0.6, 1.4] },
      { modelo: 'rocha', porKm: 10, escala: [0.7, 1.6] },
    ],
  },
} satisfies Record<string, ConfigBioma>;

export type IdBioma = keyof typeof BIOMAS;
