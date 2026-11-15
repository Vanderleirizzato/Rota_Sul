import type { DadosPatio } from './levels/TiposFase';
import { transicao } from './Ruido';

// =============================================================================
// PÁTIOS: áreas calçadas e planas fora da pista (o porto, por exemplo).
// =============================================================================
// Duas partes do jogo precisam saber "estou num pátio?":
//   - o Terreno, para deixar o chão plano e cinza ali;
//   - o Jogo, para não frear o carro como se fosse grama e não mandá-lo de
//     volta para a pista (no porto dá para passear entre os contêineres).
// Por isso a regra fica num arquivo só, e os dois usam a mesma.
// =============================================================================

/** Nas pontas do pátio, o chão muda aos poucos ao longo deste tanto (m). */
const SUAVIZAR_PONTAS = 12;
/** Na borda de fora do pátio, o chão volta ao normal ao longo deste tanto (m). */
const SUAVIZAR_BORDA = 10;

/**
 * Quanto o ponto está "dentro" de um pátio: 1 = dentro, 0 = fora, entre os
 * dois na borda. `lateral` > 0 é o lado esquerdo; `fora` é a distância depois
 * da beira do acostamento (negativa = em cima da pista).
 */
export function pesoPatio(patios: readonly DadosPatio[], distancia: number, lateral: number, fora: number): number {
  let peso = 0;
  for (const p of patios) {
    const sinal = p.lado === 'esquerda' ? 1 : -1;
    // Em cima da pista vale qualquer lado; fora dela, só o lado do pátio.
    if (fora > 0 && Math.sign(lateral) !== sinal) continue;
    const pontas = p.suavizar ?? SUAVIZAR_PONTAS;
    const borda = p.suavizar ?? SUAVIZAR_BORDA;
    const aoLongo = transicao(p.inicio - pontas, p.inicio, distancia) * (1 - transicao(p.fim, p.fim + pontas, distancia));
    const atraves = 1 - transicao(p.largura, p.largura + borda, fora);
    peso = Math.max(peso, aoLongo * atraves);
  }
  return peso;
}

/** O carro está num pátio (anda livre ali)? */
export function dentroDePatio(patios: readonly DadosPatio[], distancia: number, lateral: number, fora: number): boolean {
  return pesoPatio(patios, distancia, lateral, fora) > 0.5;
}
