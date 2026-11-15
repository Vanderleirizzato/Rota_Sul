import { Controle } from './Controle';
import { Teclado, type Acao } from './Teclado';

// Junta o teclado e o controle de videogame: o resto do jogo pergunta
// "apertou pausar?" sem se importar de onde veio o comando.

export class Entrada {
  private readonly teclado = new Teclado();
  private readonly controle = new Controle();

  /** Chamar no começo de cada quadro (lê o controle). */
  comecoDoQuadro(): void {
    this.controle.atualizar();
  }

  /** Chamar no fim de cada quadro (esquece as teclas "de um toque"). */
  fimDoQuadro(): void {
    this.teclado.fimDoQuadro();
  }

  segurando(acao: Acao): boolean {
    return this.teclado.segurando(acao) || this.controle.segurando(acao);
  }

  apertou(acao: Acao): boolean {
    return this.teclado.apertou(acao) || this.controle.apertou(acao);
  }

  /**
   * Direção de -1 a +1 (+1 = esquerda). No teclado é tudo ou nada; no
   * analógico, meio inclinado vira meia curva (bem mais fácil de dirigir).
   */
  direcao(): number {
    const teclas = (this.teclado.segurando('esquerda') ? 1 : 0) - (this.teclado.segurando('direita') ? 1 : 0);
    return teclas !== 0 ? teclas : this.controle.direcao;
  }
}
