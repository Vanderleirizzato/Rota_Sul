import type { PerspectiveCamera, Vector3 } from 'three';
import type { ConfigLuz } from '../graphics/Iluminacao';
import type { ConfigQualidade } from '../config/quality';
import type { Tracado } from './Tracado';

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
  /** Animações do cenário (água, névoa, plateia). Chamado a cada quadro. */
  atualizar(dt: number, camera: PerspectiveCamera, alturaEmPixels: number, posicaoCarro: Vector3): void;
  /** Liga/desliga o que pesa no cenário (árvores detalhadas, sombra da mata). */
  aplicarQualidade(q: ConfigQualidade): void;
}
