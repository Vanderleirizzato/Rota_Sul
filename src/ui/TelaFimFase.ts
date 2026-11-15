import './hud.css';
import { formatarTempo } from '../core/Corrida';

// Tela de Fim de Fase: o tempo da corrida e o recorde.
// (Na Etapa 5 ela ganha o botão de "próxima fase" e a volta ao menu.)

export class TelaFimFase {
  private readonly elemento: HTMLDivElement;

  constructor() {
    this.elemento = document.createElement('div');
    this.elemento.className = 'tela-fim';
    document.body.appendChild(this.elemento);
  }

  mostrar(nomeFase: string, tempo: number, recorde: number | null, recordeNovo: boolean): void {
    const linhaRecorde = recordeNovo
      ? '<div class="tela-fim-recorde novo">NOVO RECORDE!</div>'
      : recorde !== null
        ? `<div class="tela-fim-recorde">Recorde: ${formatarTempo(recorde)}</div>`
        : '';
    this.elemento.innerHTML = `
      <div class="tela-fim-caixa">
        <div class="tela-fim-rotulo">CHEGADA</div>
        <div class="tela-fim-fase">${nomeFase}</div>
        <div class="tela-fim-tempo">${formatarTempo(tempo)}</div>
        ${linhaRecorde}
        <div class="tela-fim-dica"><kbd>Enter</kbd> ou <kbd>T</kbd> correr de novo</div>
      </div>`;
    this.elemento.classList.add('visivel');
  }

  esconder(): void {
    this.elemento.classList.remove('visivel');
  }
}
