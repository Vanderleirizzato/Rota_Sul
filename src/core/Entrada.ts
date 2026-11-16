import { Controle } from './Controle';
import { Teclado, type Acao } from './Teclado';
import { Toque } from './Toque';

// Junta o teclado, o controle de videogame e os botões da tela (celular): o
// resto do jogo pergunta "apertou pausar?" sem se importar de onde veio o comando.

export class Entrada {
  private readonly teclado = new Teclado();
  private readonly controle = new Controle();
  /** Público porque os botões da tela (ControlesToque) escrevem nele. */
  readonly toque = new Toque();

  /** Chamar no começo de cada quadro (lê o controle e os toques). */
  comecoDoQuadro(): void {
    this.controle.atualizar();
    this.toque.atualizar();
  }

  /** Chamar no fim de cada quadro (esquece as teclas "de um toque"). */
  fimDoQuadro(): void {
    this.teclado.fimDoQuadro();
  }

  segurando(acao: Acao): boolean {
    return this.teclado.segurando(acao) || this.controle.segurando(acao) || this.toque.segurando(acao);
  }

  apertou(acao: Acao): boolean {
    return this.teclado.apertou(acao) || this.controle.apertou(acao) || this.toque.apertou(acao);
  }

  /**
   * Direção de -1 a +1 (+1 = esquerda). No teclado é tudo ou nada; no
   * analógico e no volante da tela, meio inclinado vira meia curva (bem mais
   * fácil de dirigir).
   */
  direcao(): number {
    const teclas = (this.teclado.segurando('esquerda') ? 1 : 0) - (this.teclado.segurando('direita') ? 1 : 0);
    if (teclas !== 0) return teclas;
    if (this.toque.direcao !== 0) return this.toque.direcao;
    return this.controle.direcao;
  }
}
