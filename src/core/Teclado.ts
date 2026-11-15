// Entrada do teclado.
//
// Usamos `event.code` (posição física da tecla) e não `event.key` (letra):
// assim o W/A/S/D funciona igual em teclado ABNT2, americano ou francês (AZERTY).

/** Ações do jogo e as teclas de cada uma. Trocar um controle é editar aqui. */
export const TECLAS = {
  acelerar: ['KeyW', 'ArrowUp'],
  frear: ['KeyS', 'ArrowDown'],
  esquerda: ['KeyA', 'ArrowLeft'],
  direita: ['KeyD', 'ArrowRight'],
  freioMao: ['Space'],
  nitro: ['ShiftLeft', 'ShiftRight'],
  reposicionar: ['KeyR'],
  /** Começa (ou recomeça do zero) a corrida, da largada (T de "tentar de novo"). */
  reiniciar: ['KeyT'],
  /** Na pausa, durante a corrida: desiste e volta a passear (Q de "quit"). */
  abandonar: ['KeyQ'],
  /** Na tela de chegada: segue viagem para a próxima fase. */
  proximaFase: ['KeyN'],
  trocarCamera: ['KeyC'],
  /** No passeio: desce do carro e anda a pé; perto do carro, entra de novo. A pé, Shift corre e Espaço pula. */
  entrarSair: ['KeyE'],
  carro1: ['Digit1', 'Numpad1'],
  carro2: ['Digit2', 'Numpad2'],
  carro3: ['Digit3', 'Numpad3'],
  painelDev: ['F2'],
  pausar: ['Escape'],
  confirmar: ['Enter', 'NumpadEnter'],
  // Menus (a mesma tecla pode servir a duas ações: no menu, W sobe na lista;
  // na corrida, acelera).
  cima: ['ArrowUp', 'KeyW'],
  baixo: ['ArrowDown', 'KeyS'],
  voltar: ['Escape', 'Backspace'],
  /** Na pausa e no fim de fase: volta ao menu principal. */
  menu: ['KeyM'],
} as const;

export type Acao = keyof typeof TECLAS;

export class Teclado {
  private readonly seguradas = new Set<string>();
  /** Teclas apertadas desde o último quadro (para ações de "um toque"). */
  private readonly apertadas = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      // Impede que setas e espaço rolem a página, e que F2 faça algo no navegador.
      if (todasAsTeclas.has(e.code)) e.preventDefault();
      if (!e.repeat) this.apertadas.add(e.code);
      this.seguradas.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.seguradas.delete(e.code));
    // Se a janela perde o foco com uma tecla pressionada, o navegador nunca
    // avisa que ela foi solta, e o carro aceleraria sozinho para sempre.
    window.addEventListener('blur', () => this.seguradas.clear());
  }

  /** A tecla está sendo segurada agora? (acelerar, virar...) */
  segurando(acao: Acao): boolean {
    return TECLAS[acao].some((codigo) => this.seguradas.has(codigo));
  }

  /** A tecla foi apertada neste quadro? (trocar câmera, reposicionar...) */
  apertou(acao: Acao): boolean {
    return TECLAS[acao].some((codigo) => this.apertadas.has(codigo));
  }

  /** Chamar no fim de cada quadro. */
  fimDoQuadro(): void {
    this.apertadas.clear();
  }
}

const todasAsTeclas = new Set<string>(Object.values(TECLAS).flat());
