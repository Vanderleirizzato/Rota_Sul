import type { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { ConfigLuz } from '../graphics/Iluminacao';
import type { ConfigQualidade } from '../config/quality';
import type { Tracado } from './Tracado';
import type { PecaPega } from './Pecas';

/** Onde o carro do jogador está e para onde vai (para o cenário reagir a ele). */
export interface EstadoCarro {
  posicao: Vector3;
  rotacao: Quaternion;
  /** Velocidade (m/s) em x, y e z. */
  velocidade: Vector3;
}

/** Batidas em coisas do cenário, de 0 (nenhuma) a 1 (forte), por tipo de som. */
export interface Impactos {
  /** Cones e barreiras de plástico. */
  plastico: number;
  /** Pessoas derrubadas. */
  macio: number;
  /** Postes derrubados. */
  metal: number;
}

/**
 * O que o Jogo precisa saber do mundo onde o carro anda, seja uma fase de
 * verdade (Fase.ts) ou a pista de teste de física (PistaTeste.ts).
 */
export interface Cenario {
  nome: string;
  local: string;
  /** Identificador usado para guardar o recorde. */
  id: string;
  largada: { posicao: Vector3; angulo: number };
  /** Linha central da estrada. A pista de teste não tem (é um plano aberto). */
  tracado: Tracado | null;
  /** Distância (m) da linha de chegada; null = sem corrida (pista de teste). */
  chegada: number | null;
  luz: ConfigLuz;
  /**
   * Fora da pista, este ponto é uma área onde o carro anda livre (pátio do
   * porto)? Lá não há freio de grama nem volta automática para a pista.
   * `lateral` > 0 = esquerda; `fora` = metros depois da beira do acostamento.
   */
  areaLivre(distancia: number, lateral: number, fora: number): boolean;
  /** Altura da água do mar (m), ou null se a fase não tem mar. Quem cai nela volta para a pista. */
  nivelMar: number | null;
  /**
   * O ponto está dentro d'água (rio ou mar)? Usado no passeio, longe da pista,
   * onde a regra "caiu abaixo do asfalto" não serve (o carro pode estar num morro).
   */
  naAgua(p: Vector3): boolean;
  /** Altura do chão (m) em (x, z), ou null onde não há terreno (pista de teste). */
  alturaChao(x: number, z: number): number | null;
  /**
   * Animações do cenário (água, plateia, trânsito). Chamado a cada quadro.
   * `alfa`: quanto já andamos entre o último passo de física e o próximo
   * (0 a 1), para desenhar o trânsito suave, como o carro.
   */
  atualizar(dt: number, camera: PerspectiveCamera, alturaEmPixels: number, posicaoCarro: Vector3, alfa: number): void;
  /**
   * Um passo de física (1/60 s): o trânsito anda aqui, junto com o carro, e
   * o que o carro está a ponto de atingir (veículo, poste) vira objeto solto.
   */
  passoFisica(dt: number, carro: EstadoCarro): void;
  /** As batidas mais fortes desde a última consulta (e zera a contagem). */
  colherImpactos(): Impactos;
  /** Tempo-meta (s) que libera a próxima fase, ou null se esta fase não libera nada. */
  tempoParaLiberar: number | null;
  /** Quantas peças de tuning esta fase tem (0 = nenhuma). */
  totalPecas: number;
  /** A peça de tuning pega desde a última consulta (uma por vez), ou null. */
  colherPeca(): PecaPega | null;
  /** True uma única vez, quando o carro encosta no troféu escondido (ver Trofeu.ts). */
  pegouTrofeu(): boolean;
  /** Corrida reiniciada (tecla T): cones voltam ao lugar, trânsito recomeça. */
  reiniciar(): void;
  /** Liga/desliga o que pesa no cenário (árvores detalhadas, sombra da mata). */
  aplicarQualidade(q: ConfigQualidade): void;
}
