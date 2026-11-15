import './hud.css';
import { formatarTempo, type EstadoCorrida } from '../core/Corrida';

// Parte do HUD que só existe nas fases: cronômetro no alto da tela, nome da
// fase e a contagem regressiva grande no meio.

export class HudCorrida {
  private readonly cronometro: HTMLElement;
  private readonly contagem: HTMLElement;
  private readonly titulo: HTMLElement;
  private textoContagem = '';

  constructor(nome: string, local: string, recorde: number | null) {
    this.cronometro = document.createElement('div');
    this.cronometro.className = 'hud-cronometro';
    this.contagem = document.createElement('div');
    this.contagem.className = 'hud-contagem';
    this.titulo = document.createElement('div');
    this.titulo.className = 'hud-titulo-fase';
    const linhaRecorde = recorde === null ? '' : `<small>Recorde: ${formatarTempo(recorde)}</small>`;
    this.titulo.innerHTML = `<strong>${nome}</strong><span>${local}</span>${linhaRecorde}`;
    document.body.append(this.cronometro, this.contagem, this.titulo);
  }

  atualizar(estado: EstadoCorrida, tempo: number, restante: number): void {
    this.cronometro.textContent = formatarTempo(tempo);
    this.titulo.classList.toggle('visivel', estado === 'contagem');

    // "VAI!" fica na tela por um instante depois da largada.
    const texto = estado === 'contagem' ? String(Math.ceil(restante)) : estado === 'correndo' && tempo < 0.8 ? 'VAI!' : '';
    if (texto !== this.textoContagem) {
      this.textoContagem = texto;
      this.contagem.textContent = texto;
      // Reinicia a animação de "pulo" a cada número novo.
      this.contagem.classList.remove('pulo');
      void this.contagem.offsetWidth; // força o navegador a perceber a remoção
      if (texto) this.contagem.classList.add('pulo');
    }
  }

  /** Atualiza o recorde mostrado na largada (depois de uma corrida). */
  mostrarRecorde(recorde: number): void {
    const small = this.titulo.querySelector('small') ?? this.titulo.appendChild(document.createElement('small'));
    small.textContent = `Recorde: ${formatarTempo(recorde)}`;
  }
}
