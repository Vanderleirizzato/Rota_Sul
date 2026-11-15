import { Quaternion, Vector3 } from 'three';
import type { EstadoCarro } from './Cenario';

/** Meia largura e meio comprimento (m) do carro do jogador, para as contas de contato. */
export const CARRO_JOGADOR = { meiaLargura: 1, meioComprimento: 2.3 };

const local = new Vector3();
const inversa = new Quaternion();

/**
 * O carro está encostando (ou a ponto de encostar) num objeto "redondo" de
 * raio `raio` no `ponto`? A conta é feita nos eixos do carro: assim um carro
 * de lado, comprido, não "pega" uma pessoa que está a 2 m da porta.
 * `antecipar` (s): olha onde o carro estará daqui a pouco, para reagir
 * ANTES da física juntar os dois (ver Postes.ts).
 */
export function carroAlcanca(carro: EstadoCarro, ponto: Vector3, raio: number, antecipar = 0): boolean {
  local.copy(ponto).sub(carro.posicao).addScaledVector(carro.velocidade, -antecipar);
  local.applyQuaternion(inversa.copy(carro.rotacao).invert());
  return (
    Math.abs(local.x) < CARRO_JOGADOR.meiaLargura + raio &&
    Math.abs(local.z) < CARRO_JOGADOR.meioComprimento + raio &&
    Math.abs(local.y) < 2.5
  );
}
