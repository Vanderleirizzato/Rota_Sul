import type { Acao } from './Teclado';

// =============================================================================
// CONTROLE DE VIDEOGAME (Gamepad API)
// =============================================================================
// O navegador não avisa quando um botão do controle é apertado (não há
// evento como o "keydown" do teclado). Por isso, a cada quadro, perguntamos
// o estado de cada botão (navigator.getGamepads()) e comparamos com o quadro
// anterior para saber o que acabou de ser apertado.
//
// Os números dos botões seguem o "mapeamento padrão" (Xbox, PlayStation e a
// maioria dos genéricos no navegador):
//   0 = A / ✕    1 = B / ○    2 = X / □    3 = Y / △
//   6 = gatilho esquerdo (LT/L2)    7 = gatilho direito (RT/R2)
//   8 = Back/Select    9 = Start    12-15 = setas (cima, baixo, esquerda, direita)
// Trocar um botão de função é editar a tabela BOTOES abaixo.
// =============================================================================

/** Ação de cada botão. Um botão pode ter mais de uma ação (no menu e na corrida). */
const BOTOES: Partial<Record<Acao, number[]>> = {
  nitro: [0, 5],
  confirmar: [0],
  freioMao: [1],
  voltar: [1],
  menu: [1], // na pausa: B volta ao menu
  reposicionar: [2],
  abandonar: [2], // na pausa: X abandona a corrida
  trocarCamera: [3],
  proximaFase: [3], // na tela de chegada: Y segue viagem
  reiniciar: [8],
  pausar: [9],
  cima: [12],
  baixo: [13],
  esquerda: [14],
  direita: [15],
};

/** Abaixo disto, o analógico é considerado parado (todo analógico "treme" um pouco no centro). */
const ZONA_MORTA = 0.15;
/** Gatilho mais apertado que isto conta como "apertado". */
const GATILHO = 0.1;
/** No menu, o analógico inclinado além disto vale como seta. */
const ANALOGICO_COMO_SETA = 0.6;

export class Controle {
  private atual = new Set<Acao>();
  private anterior = new Set<Acao>();
  /** Direção do analógico esquerdo: +1 = toda para a esquerda (como no carro), -1 = direita. */
  direcao = 0;
  /** Quanto os gatilhos estão apertados (0 a 1). */
  acelerador = 0;
  freio = 0;

  /** Chamar uma vez no começo de cada quadro. */
  atualizar(): void {
    this.anterior = this.atual;
    this.atual = new Set();
    this.direcao = 0;
    this.acelerador = 0;
    this.freio = 0;
    // getGamepads() pode não existir (navegador antigo) e tem buracos (null)
    // no lugar dos controles desconectados.
    const controles = navigator.getGamepads?.() ?? [];
    for (const c of controles) {
      if (!c || !c.connected) continue;
      for (const [acao, botoes] of Object.entries(BOTOES) as [Acao, number[]][]) {
        if (botoes.some((b) => c.buttons[b]?.pressed)) this.atual.add(acao);
      }
      const x = c.axes[0] ?? 0;
      const y = c.axes[1] ?? 0;
      if (Math.abs(x) > ZONA_MORTA) this.direcao = -x;
      if (x < -ANALOGICO_COMO_SETA) this.atual.add('esquerda');
      if (x > ANALOGICO_COMO_SETA) this.atual.add('direita');
      if (y < -ANALOGICO_COMO_SETA) this.atual.add('cima');
      if (y > ANALOGICO_COMO_SETA) this.atual.add('baixo');
      // Gatilhos são analógicos (0 a 1): usamos o valor, não só "apertado".
      this.acelerador = Math.max(this.acelerador, c.buttons[7]?.value ?? 0);
      this.freio = Math.max(this.freio, c.buttons[6]?.value ?? 0);
      if (this.acelerador > GATILHO) this.atual.add('acelerar');
      if (this.freio > GATILHO) this.atual.add('frear');
    }
  }

  segurando(acao: Acao): boolean {
    return this.atual.has(acao);
  }

  /** Apertou agora (não estava apertado no quadro anterior). */
  apertou(acao: Acao): boolean {
    return this.atual.has(acao) && !this.anterior.has(acao);
  }
}
