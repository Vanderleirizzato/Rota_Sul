import type { Acao } from './Teclado';

// =============================================================================
// COMANDOS PELA TELA (dedo ou mouse)
// =============================================================================
// Terceira fonte de comandos, ao lado do teclado e do controle (ver
// Entrada.ts). Guarda só o ESTADO: quais botões estão sendo segurados e para
// onde o volante virtual aponta. Quem desenha os botões é o ControlesToque.
//
// Além disso, qualquer elemento da página com o atributo
// `data-acao-jogo="..."` vira um botão: um clique (ou toque) nele vale como
// apertar a tecla daquela ação. É assim que os botões da pausa e da chegada
// funcionam, com mouse no PC e com o dedo no celular, sem código extra.
// =============================================================================

/** Volante (ou joystick a pé) inclinado além disto conta como "segurando" a direção. */
const INCLINACAO_COMO_TECLA = 0.35;

export class Toque {
  /** Botões da tela sendo segurados agora. */
  private readonly seguradas = new Set<Acao>();
  /** Apertados desde o último quadro (ainda não vistos pelo jogo). */
  private pendentes = new Set<Acao>();
  /** Apertados neste quadro (valem para `apertou`). */
  private apertadas = new Set<Acao>();
  /** Volante virtual: +1 = todo para a esquerda (como no carro), -1 = direita. */
  direcao = 0;
  /** Joystick para cima (+1) ou para baixo (-1). Só conta a pé (ver aPe). */
  frente = 0;
  /**
   * A pé, o joystick para cima anda para a frente (como o W). No carro não:
   * lá acelerar e frear são botões separados, senão o dedo que só queria
   * virar acabaria acelerando sem querer ao arrastar um pouco na diagonal.
   */
  aPe = false;

  constructor() {
    document.addEventListener('click', (e) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao-jogo]');
      const acao = alvo?.dataset.acaoJogo;
      if (acao) this.tocar(acao as Acao);
    });
    // Igual ao teclado: perdeu o foco, nada fica "preso" apertado.
    window.addEventListener('blur', () => this.soltarTudo());
  }

  /** Um toque rápido (vale um quadro como `apertou`). */
  tocar(acao: Acao): void {
    this.pendentes.add(acao);
  }

  /** O dedo pousou num botão: está segurando e também acabou de apertar. */
  segurar(acao: Acao): void {
    this.seguradas.add(acao);
    this.pendentes.add(acao);
  }

  soltar(acao: Acao): void {
    this.seguradas.delete(acao);
  }

  soltarTudo(): void {
    this.seguradas.clear();
    this.direcao = 0;
    this.frente = 0;
  }

  /** Chamar uma vez no começo de cada quadro. */
  atualizar(): void {
    this.apertadas = this.pendentes;
    this.pendentes = new Set();
  }

  segurando(acao: Acao): boolean {
    if (this.seguradas.has(acao)) return true;
    if (acao === 'esquerda') return this.direcao > INCLINACAO_COMO_TECLA;
    if (acao === 'direita') return this.direcao < -INCLINACAO_COMO_TECLA;
    if (!this.aPe) return false;
    if (acao === 'acelerar') return this.frente > INCLINACAO_COMO_TECLA;
    if (acao === 'frear') return this.frente < -INCLINACAO_COMO_TECLA;
    return false;
  }

  apertou(acao: Acao): boolean {
    return this.apertadas.has(acao);
  }
}
