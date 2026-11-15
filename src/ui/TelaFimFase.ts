import './hud.css';
import { formatarTempo } from '../core/Corrida';

// Tela de Fim de Fase: o tempo da corrida, o recorde, se a próxima fase foi
// liberada e o que fazer depois (continuar passeando, correr de novo, seguir
// viagem ou ir ao menu).

/** A situação da próxima fase da viagem, vista da chegada. */
export interface SituacaoViagem {
  /** Nome da próxima fase. */
  proxima: string;
  /** Ela está liberada (agora ou de antes)? */
  liberada: boolean;
  /** Foi liberada AGORA, nesta corrida? (Merece festa.) */
  acabouDeLiberar: boolean;
  /** Tempo-meta para liberar (s), se existe. */
  meta: number | null;
}

export class TelaFimFase {
  private readonly elemento: HTMLDivElement;

  constructor() {
    this.elemento = document.createElement('div');
    this.elemento.className = 'tela-fim';
    document.body.appendChild(this.elemento);
  }

  /** @param viagem a próxima fase, ou null se esta é a última da viagem. */
  mostrar(nomeFase: string, tempo: number, recorde: number | null, recordeNovo: boolean, viagem: SituacaoViagem | null): void {
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
        ${linhaViagem(viagem)}
        <div class="tela-fim-dica"><kbd>Enter</kbd> continuar passeando &nbsp;·&nbsp; 🎮 <kbd>A</kbd></div>
        <div class="tela-fim-dica"><kbd>T</kbd> correr de novo · <kbd>M</kbd> menu</div>
      </div>`;
    this.elemento.classList.add('visivel');
  }

  esconder(): void {
    this.elemento.classList.remove('visivel');
  }
}

function linhaViagem(v: SituacaoViagem | null): string {
  if (!v) return '<div class="tela-fim-viagem">Fim da viagem! 🎉</div>';
  const seguir = `<kbd>N</kbd> seguir viagem para <b>${v.proxima}</b> &nbsp;·&nbsp; 🎮 <kbd>Y</kbd>`;
  if (v.acabouDeLiberar) return `<div class="tela-fim-viagem novo">🔓 ${v.proxima} liberado!</div><div class="tela-fim-dica">${seguir}</div>`;
  if (v.liberada) return `<div class="tela-fim-dica">${seguir}</div>`;
  if (v.meta !== null) {
    return `<div class="tela-fim-viagem">🔒 Faça abaixo de <b>${formatarTempo(v.meta)}</b> para liberar <b>${v.proxima}</b></div>`;
  }
  return '';
}
