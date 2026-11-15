import { tuning } from '../config/tuning';

// Câmbio automático "de mentira": a partir da velocidade, decide a marcha e o
// giro do motor. Não muda a física (a força vem da curva do motor em
// VeiculoFisico); serve ao conta-giros e ao som. Separado assim, dá para
// mexer no som das trocas sem estragar a dirigibilidade.

export type Marcha = 'R' | 'N' | number;
export type Troca = 'subiu' | 'desceu' | null;

/** Quão rápido o ponteiro do conta-giros alcança o giro calculado (rpm/s). */
const VELOCIDADE_PONTEIRO = 9000;

export class Transmissao {
  marcha: Marcha = 'N';
  rpm = tuning.transmissao.rpmMarchaLenta;
  private marchaNumero = 1;

  /**
   * @param velocidade m/s para a frente (negativa de ré)
   * @param acelerando o jogador segura o acelerador
   * @param rodasLivres rodas sem tração no chão (no ar ou no freio de mão): o motor "grita"
   */
  atualizar(dt: number, velocidade: number, acelerando: boolean, rodasLivres: boolean): Troca {
    const t = tuning.transmissao;
    const kmh = velocidade * 3.6;
    let troca: Troca = null;
    let alvo: number;

    if (kmh < -1) {
      this.marcha = 'R';
      alvo = this.rpmNaMarcha(-kmh, t.velocidadeMaximaMarchas[0]);
    } else if (kmh < 2 && !acelerando) {
      this.marcha = 'N';
      this.marchaNumero = 1;
      alvo = t.rpmMarchaLenta;
    } else {
      troca = this.escolherMarcha(kmh);
      this.marcha = this.marchaNumero;
      alvo = this.rpmNaMarcha(kmh, t.velocidadeMaximaMarchas[this.marchaNumero - 1]);
    }
    if (acelerando && rodasLivres) alvo = t.rpmMaximo * 0.95;

    // Na troca para cima o giro despenca na hora (como num carro de verdade);
    // nos outros casos o ponteiro anda com velocidade limitada.
    if (troca === 'subiu') {
      this.rpm = alvo;
    } else {
      const passo = VELOCIDADE_PONTEIRO * dt;
      this.rpm += Math.max(-passo, Math.min(passo, alvo - this.rpm));
    }
    return troca;
  }

  private escolherMarcha(kmh: number): Troca {
    const t = tuning.transmissao;
    const marchas = t.velocidadeMaximaMarchas;
    const rpmAtual = this.rpmNaMarcha(kmh, marchas[this.marchaNumero - 1]);
    if (rpmAtual > t.rpmTrocaSubida && this.marchaNumero < marchas.length) {
      this.marchaNumero++;
      return 'subiu';
    }
    if (this.marchaNumero > 1) {
      // Só desce se, na marcha de baixo, o motor não passar do ponto de subir
      // de novo. Sem essa folga, o câmbio ficaria trocando sem parar.
      const rpmAbaixo = this.rpmNaMarcha(kmh, marchas[this.marchaNumero - 2]);
      if (rpmAtual < t.rpmTrocaDescida && rpmAbaixo < t.rpmTrocaSubida * 0.9) {
        this.marchaNumero--;
        return 'desceu';
      }
    }
    return null;
  }

  private rpmNaMarcha(kmh: number, velocidadeMaximaDaMarcha: number): number {
    const t = tuning.transmissao;
    return t.rpmMarchaLenta + (t.rpmMaximo - t.rpmMarchaLenta) * Math.min(kmh / velocidadeMaximaDaMarcha, 1.05);
  }
}
