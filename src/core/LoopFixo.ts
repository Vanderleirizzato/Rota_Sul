// Laço de física com passo fixo e acumulador.
//
// Por que passo fixo: o monitor pode rodar a 60, 144 ou 30 quadros por
// segundo, e cada quadro tem duração um pouco diferente. Se a física usasse
// essa duração variável, a suspensão e o atrito se comportariam diferente em
// cada computador (molas podem até "explodir" com passos grandes). Com passo
// fixo de 1/60 s, a física é sempre a mesma.
//
// Como funciona: o tempo real de cada quadro vai para um "acumulador". Enquanto
// houver pelo menos um passo inteiro guardado, roda um passo de física. O que
// sobra (uma fração de passo) vira `alfa`, usado para desenhar o carro entre a
// posição anterior e a atual (interpolação). Sem isso, num monitor de 144 Hz o
// carro andaria "aos trancos", parado em alguns quadros e pulando em outros.

/** Limite de passos por quadro. Se o computador travar por 1 s, não tentamos
 *  recuperar 60 passos de uma vez (isso travaria ainda mais: "espiral da morte"). */
const MAX_PASSOS_POR_QUADRO = 5;

export class LoopFixo {
  private acumulador = 0;

  constructor(private readonly passo: number) {}

  /**
   * Recebe o tempo real do quadro e roda quantos passos de física couberem.
   * Devolve `alfa` (0 a 1): quanto já andamos rumo ao próximo passo.
   */
  avancar(tempoDoQuadro: number, rodarPasso: (passo: number) => void): number {
    this.acumulador += Math.min(tempoDoQuadro, this.passo * MAX_PASSOS_POR_QUADRO);
    while (this.acumulador >= this.passo) {
      rodarPasso(this.passo);
      this.acumulador -= this.passo;
    }
    return this.acumulador / this.passo;
  }
}
