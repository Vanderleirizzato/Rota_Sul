// Tela de pausa simples. (O menu completo, com "voltar ao menu", vem na Etapa 5.)

export class TelaPausa {
  private readonly elemento: HTMLDivElement;

  constructor() {
    this.elemento = document.createElement('div');
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
        <div>Aperte <b>Esc</b> para continuar</div>
        <div style="margin-top: 24px; opacity: 0.8; font-size: 15px">
          W/↑ acelerar · S/↓ frear e ré · A/D ou ←/→ direção<br />
          Espaço freio de mão · Shift nitro · R reposicionar · C câmera
        </div>
      </div>`;
    document.body.appendChild(this.elemento);
  }

  mostrar(visivel: boolean): void {
    this.elemento.style.display = visivel ? 'grid' : 'none';
  }
}
