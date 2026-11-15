// HUD provisório da Etapa 1A: só texto. O HUD arcade de verdade vem na 1B.

export class HudSimples {
  private readonly elemento: HTMLDivElement;

  constructor() {
    this.elemento = document.createElement('div');
    Object.assign(this.elemento.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      font: 'bold 20px/1.4 ui-monospace, monospace',
      textShadow: '0 0 4px #000',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    });
    document.body.appendChild(this.elemento);
  }

  atualizar(velocidadeMs: number, nitro: number, nitroLigado: boolean, derrapando: boolean, camera: string): void {
    const kmh = Math.round(Math.abs(velocidadeMs) * 3.6);
    const barra = '█'.repeat(Math.round(nitro * 10)).padEnd(10, '·');
    this.elemento.textContent =
      `${String(kmh).padStart(3)} km/h${velocidadeMs < -0.5 ? '  (ré)' : ''}\n` +
      `Nitro ${barra}${nitroLigado ? '  🔥' : ''}${derrapando ? '  DRIFT' : ''}\n` +
      `Câmera: ${camera}   |   F2: tuning   R: reposicionar   1/2: carro`;
  }
}
