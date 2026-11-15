import './hud.css';
import { formatarTempo } from '../core/Corrida';

// Tela de Fim de Fase: o tempo da corrida, o recorde e o que fazer depois
// (próxima fase, correr de novo ou voltar ao menu).

export class TelaFimFase {
  private readonly elemento: HTMLDivElement;

  constructor() {
    this.elemento = document.createElement('div');
    this.elemento.className = 'tela-fim';
    document.body.appendChild(this.elemento);
  }

  /** @param proxima nome da próxima fase, ou null se esta é a última da viagem. */
  mostrar(nomeFase: string, tempo: number, recorde: number | null, recordeNovo: boolean, proxima: string | null): void {
    const linhaEnter = proxima
      ? `<kbd>Enter</kbd> próxima fase: <b>${proxima}</b>`
      : `Fim da viagem! <kbd>Enter</kbd> voltar ao menu`;
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
        <div class="tela-fim-dica">${linhaEnter}</div>
        <div class="tela-fim-dica"><kbd>T</kbd> correr de novo · <kbd>M</kbd> menu</div>
      </div>`;
    this.elemento.classList.add('visivel');
  }

  esconder(): void {
    this.elemento.classList.remove('visivel');
  }
}
