import './toque.css';
import type { Acao } from '../core/Teclado';
import type { Toque } from '../core/Toque';

// =============================================================================
// CONTROLES NA TELA (celular e tablet)
// =============================================================================
// Só aparecem em aparelhos de toque (ver Dispositivo.ts). Desenho:
//
//   [⏸][🎥][↺]                                  (velocímetro)
//
//                                          [🚪]
//                                       [🔥 NITRO]
//      (  volante  )             [FREIO DE MÃO]
//                                 [FREIO]  [ACELERAR]
//
// - Lado esquerdo: um volante "flutuante". Onde o dedo pousar vira o centro,
//   e arrastar para os lados vira o carro. Flutuante porque cada pessoa
//   segura o celular de um jeito: o centro vai até o dedo, não o contrário.
// - Lado direito: pedais e botões. Cada botão é "segurável" (o carro só
//   acelera enquanto o dedo estiver em cima) e vários dedos funcionam juntos.
// - A pé, o mesmo volante vira joystick (para cima anda), e os botões mudam:
//   freio de mão vira PULAR e nitro vira CORRER (as mesmas ações do teclado).
//
// Os botões só mexem no estado do `Toque`; o jogo lê tudo pela `Entrada`,
// igual ao teclado. Trocar um botão de lugar é mexer no toque.css.
// =============================================================================

/** Quanto (px) o dedo precisa arrastar para virar o volante até o fim. */
const RAIO_VOLANTE = 60;

interface Botao {
  acao: Acao;
  /** Classe CSS (posição e tamanho ficam no toque.css). */
  classe: string;
  /** Texto no carro e a pé (vazio = o botão some a pé). */
  noCarro: string;
  aPe: string;
}

const BOTOES: Botao[] = [
  { acao: 'pausar', classe: 'toque-pausa', noCarro: '⏸', aPe: '⏸' },
  { acao: 'trocarCamera', classe: 'toque-camera', noCarro: '🎥', aPe: '🎥' },
  { acao: 'reposicionar', classe: 'toque-reposicionar', noCarro: '↺', aPe: '↺' },
  { acao: 'painelDev', classe: 'toque-dev', noCarro: '🔧', aPe: '🔧' },
  { acao: 'acelerar', classe: 'toque-acelerar', noCarro: '▲<small>ACELERAR</small>', aPe: '' },
  { acao: 'frear', classe: 'toque-frear', noCarro: '▼<small>FREIO / RÉ</small>', aPe: '' },
  { acao: 'freioMao', classe: 'toque-freio-mao', noCarro: '<small>FREIO DE MÃO</small>', aPe: '⤒<small>PULAR</small>' },
  { acao: 'nitro', classe: 'toque-nitro', noCarro: '🔥<small>NITRO</small>', aPe: '🏃<small>CORRER</small>' },
  { acao: 'entrarSair', classe: 'toque-entrar', noCarro: '🚪<small>DESCER</small>', aPe: '🚗<small>ENTRAR</small>' },
];

export class ControlesToque {
  private readonly raiz: HTMLDivElement;
  private readonly botoes = new Map<HTMLButtonElement, Botao>();
  private readonly baseVolante: HTMLDivElement;
  private readonly bolaVolante: HTMLDivElement;
  /** O dedo que está no volante (cada dedo na tela tem um número próprio). */
  private dedoVolante: number | null = null;
  private centroX = 0;
  private centroY = 0;
  private aPe: boolean | null = null;

  /** @param painelDevLiberado o botão 🔧 só aparece depois do troféu (ou no npm run dev). */
  constructor(
    private readonly toque: Toque,
    painelDevLiberado: boolean,
  ) {
    this.raiz = document.createElement('div');
    this.raiz.className = 'toque';
    this.raiz.innerHTML = `
      <div class="toque-zona-volante"></div>
      <div class="toque-volante-base"><div class="toque-volante-bola"></div></div>`;
    this.baseVolante = this.raiz.querySelector('.toque-volante-base') as HTMLDivElement;
    this.bolaVolante = this.raiz.querySelector('.toque-volante-bola') as HTMLDivElement;
    for (const b of BOTOES) this.criarBotao(b);
    this.liberarPainelDev(painelDevLiberado);
    document.body.appendChild(this.raiz);

    this.ligarVolante(this.raiz.querySelector('.toque-zona-volante') as HTMLDivElement);
    // Segurar o dedo na tela abriria o menu de "copiar/salvar imagem" do celular.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    // Tela cheia (some a barra do navegador): só dá para pedir depois de um
    // toque do jogador (regra dos navegadores). `pointerup` porque, no
    // celular, é o fim do toque que conta como "gesto", não o começo. Tenta
    // a cada toque até conseguir; depois disso, para de insistir (se o
    // jogador sair da tela cheia de propósito, o jogo respeita).
    const tentarTelaCheia = (): void => {
      void pedirTelaCheia().then((conseguiu) => {
        if (conseguiu) window.removeEventListener('pointerup', tentarTelaCheia);
      });
    };
    window.addEventListener('pointerup', tentarTelaCheia);
    this.mostrarAPe(false);
  }

  /** Troca os botões entre "dirigindo" e "a pé" (chamar a cada quadro: só mexe quando muda). */
  mostrarAPe(aPe: boolean): void {
    if (aPe === this.aPe) return;
    this.aPe = aPe;
    this.toque.aPe = aPe;
    this.raiz.classList.toggle('a-pe', aPe);
    // Um botão que sumiu (ex.: acelerar ao descer) não pode ficar "apertado".
    this.toque.soltarTudo();
    this.soltarVolante();
    for (const [el, b] of this.botoes) {
      const texto = aPe ? b.aPe : b.noCarro;
      el.innerHTML = texto;
      el.hidden = texto === '';
    }
  }

  /** Mostra o botão 🔧 (painel de tuning). */
  liberarPainelDev(liberado = true): void {
    this.raiz.classList.toggle('com-dev', liberado);
  }

  // ---------------------------------------------------------------------------

  private criarBotao(b: Botao): void {
    const el = document.createElement('button');
    el.className = `toque-botao ${b.classe}`;
    this.botoes.set(el, b);
    // "Captura": o dedo continua sendo deste botão mesmo se escorregar um
    // pouco para fora dele. Sem isso, o acelerador soltaria sozinho.
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('apertado');
      this.toque.segurar(b.acao);
    });
    const soltar = (): void => {
      el.classList.remove('apertado');
      this.toque.soltar(b.acao);
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    this.raiz.appendChild(el);
  }

  private ligarVolante(zona: HTMLDivElement): void {
    zona.addEventListener('pointerdown', (e) => {
      if (this.dedoVolante !== null) return;
      e.preventDefault();
      zona.setPointerCapture(e.pointerId);
      this.dedoVolante = e.pointerId;
      this.centroX = e.clientX;
      this.centroY = e.clientY;
      this.baseVolante.classList.add('ativo');
      this.baseVolante.style.left = `${e.clientX}px`;
      this.baseVolante.style.top = `${e.clientY}px`;
      this.baseVolante.style.bottom = 'auto';
      this.moverBola(0, 0);
    });
    zona.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dedoVolante) return;
      const dx = limitar((e.clientX - this.centroX) / RAIO_VOLANTE);
      const dy = limitar((e.clientY - this.centroY) / RAIO_VOLANTE);
      this.moverBola(dx, dy);
      // Para a direita na tela = virar para a direita, que no jogo é negativo.
      this.toque.direcao = -dx;
      this.toque.frente = -dy;
    });
    const soltar = (e: PointerEvent): void => {
      if (e.pointerId === this.dedoVolante) this.soltarVolante();
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
  }

  /** O volante volta ao centro e ao lugar de descanso (canto de baixo). */
  private soltarVolante(): void {
    this.dedoVolante = null;
    this.toque.direcao = 0;
    this.toque.frente = 0;
    this.baseVolante.classList.remove('ativo');
    this.baseVolante.style.left = '';
    this.baseVolante.style.top = '';
    this.baseVolante.style.bottom = '';
    this.moverBola(0, 0);
  }

  private moverBola(x: number, y: number): void {
    this.bolaVolante.style.transform = `translate(${x * RAIO_VOLANTE}px, ${y * RAIO_VOLANTE}px)`;
  }
}

function limitar(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Pede tela cheia (some a barra de endereço). Não travamos a orientação:
 * dá para jogar em pé ou deitado. O Safari do iPhone não tem tela cheia para
 * páginas; lá, o jeito é "Compartilhar → Adicionar à Tela de Início", que
 * abre o jogo como um aplicativo, sem a barra (ver as <meta> do index.html).
 * @returns true se a tela cheia está ligada (ou o navegador não tem como ligar).
 */
async function pedirTelaCheia(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  if (!document.documentElement.requestFullscreen) return true; // iPhone: não adianta insistir
  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false; // tenta de novo no próximo toque
  }
}
