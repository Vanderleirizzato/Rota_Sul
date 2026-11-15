import { aoProgredir, type Progresso } from '../world/ProgressoDownload';

// =============================================================================
// BARRA DE CARREGAMENTO
// =============================================================================
// Ocupa o lugar do aviso "Carregando…" do index.html e mostra o progresso de
// verdade: quantos arquivos já chegaram e quantos megabytes foram baixados.
// Num servidor de hospedagem (e numa internet lenta), a primeira vez pode
// levar um tempinho: sem barra, parece que o jogo travou.
// =============================================================================

export class BarraCarregamento {
  private readonly preenchimento: HTMLDivElement;
  private readonly etapa: HTMLDivElement;
  private readonly detalhe: HTMLDivElement;
  private readonly pararDeOuvir: () => void;
  /** A barra nunca anda para trás (o total cresce quando chegam pedidos novos). */
  private fracao = 0;

  constructor(private readonly elemento: HTMLElement) {
    elemento.innerHTML = `
      <div class="carregando-caixa">
        <div class="carregando-titulo">ROTA SUL</div>
        <div class="carregando-etapa">Preparando…</div>
        <div class="carregando-trilho"><div class="carregando-barra"></div></div>
        <div class="carregando-detalhe">&nbsp;</div>
      </div>`;
    this.etapa = elemento.querySelector('.carregando-etapa') as HTMLDivElement;
    this.preenchimento = elemento.querySelector('.carregando-barra') as HTMLDivElement;
    this.detalhe = elemento.querySelector('.carregando-detalhe') as HTMLDivElement;
    this.pararDeOuvir = aoProgredir((p) => this.mostrar(p));
  }

  /** Texto da etapa atual ("Baixando os modelos 3D…", "Preparando os gráficos…"). */
  definirEtapa(texto: string): void {
    this.etapa.textContent = texto;
  }

  /** Tudo pronto: some com a barra. */
  remover(): void {
    this.pararDeOuvir();
    this.elemento.remove();
  }

  private mostrar(p: Progresso): void {
    const bytes = p.bytesTotal > 0 ? p.bytesBaixados / p.bytesTotal : 0;
    const arquivos = p.arquivosPedidos > 0 ? p.arquivosProntos / p.arquivosPedidos : 0;
    // Média das duas medidas: arquivos pequenos e grandes pesam de forma justa.
    this.fracao = Math.max(this.fracao, (bytes + arquivos) / 2);
    this.preenchimento.style.width = `${(this.fracao * 100).toFixed(1)}%`;
    const mb = (p.bytesBaixados / 1024 / 1024).toFixed(1).replace('.', ',');
    this.detalhe.textContent = `${p.arquivosProntos} de ${p.arquivosPedidos} arquivos · ${mb} MB`;
  }
}
