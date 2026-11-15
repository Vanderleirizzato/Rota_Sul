import './menu.css';

// Tela de pausa: continuar, (re)começar a corrida, abandonar a corrida ou voltar ao menu.

export class TelaPausa {
  private readonly elemento: HTMLDivElement;
  private readonly opcoes: HTMLElement;

  constructor() {
    this.elemento = document.createElement('div');
    this.elemento.className = 'tela-pausa';
    Object.assign(this.elemento.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      placeItems: 'center',
      background: 'rgba(5, 8, 14, 0.6)',
      backdropFilter: 'blur(3px)',
      textAlign: 'center',
      font: '18px/1.8 system-ui, sans-serif',
      zIndex: '10',
    });
    this.elemento.innerHTML = `
      <div>
        <div style="font: 800 52px ui-monospace, monospace; letter-spacing: 6px">PAUSADO</div>
        <div class="tela-pausa-opcoes"></div>
        <div style="margin-top: 24px; opacity: 0.8; font-size: 15px">
          W/↑ acelerar · S/↓ frear e ré · A/D ou ←/→ direção<br />
          Espaço freio de mão · Shift nitro · R reposicionar · C câmera
        </div>
        <div style="margin-top: 14px; opacity: 0.65; font-size: 14px">
          🎮 Controle: RT acelera · LT freia · analógico esquerdo vira · A nitro · B freio de mão<br />
          X reposiciona · Y câmera · Start pausa · Back corre da largada · na pausa, X abandona e B volta ao menu
        </div>
      </div>`;
    document.body.appendChild(this.elemento);
    this.opcoes = this.elemento.querySelector('.tela-pausa-opcoes') as HTMLElement;
  }

  /** @param emProva true durante a corrida (contagem ou correndo): aí dá para abandonar. */
  mostrar(visivel: boolean, emProva = false): void {
    this.elemento.style.display = visivel ? 'grid' : 'none';
    this.opcoes.innerHTML = emProva
      ? '<kbd>Esc</kbd> continuar · <kbd>T</kbd> recomeçar a corrida · <kbd>Q</kbd> abandonar a corrida · <kbd>M</kbd> voltar ao menu'
      : '<kbd>Esc</kbd> continuar · <kbd>T</kbd> ir para a largada e correr · <kbd>M</kbd> voltar ao menu';
  }
}
