import { dica } from '../core/Dispositivo';
import './menu.css';

// Faixa grande no meio da tela: "Easter Egg Encontrado: Modo Dev Ativado!".
// Aparece, fica alguns segundos e some sozinha (a animação está no menu.css).

const DURACAO_MS = 7000;

export class MensagemEasterEgg {
  private readonly elemento: HTMLDivElement;
  private timer = 0;

  constructor() {
    this.elemento = document.createElement('div');
    this.elemento.className = 'easter-egg';
    document.body.appendChild(this.elemento);
  }

  mostrar(primeiraVez: boolean): void {
    this.elemento.innerHTML = `
      <div class="easter-egg-rotulo">🏆 EASTER EGG ENCONTRADO</div>
      <div class="easter-egg-titulo">Modo Dev Ativado!</div>
      <div class="easter-egg-dica">
        ${primeiraVez ? 'Parabéns, Enzo! ' : ''}Super velocidade ligada. ${dica('Aperte <kbd>F2</kbd>', 'Toque no 🔧')} para abrir o painel de tuning.
      </div>`;
    this.elemento.classList.add('visivel');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.elemento.classList.remove('visivel'), DURACAO_MS);
  }
}
