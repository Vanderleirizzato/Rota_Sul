import './hud.css';
import { formatarTempo, type EstadoCorrida } from '../core/Corrida';

// Parte do HUD que só existe nas fases.
//  - Na corrida: cronômetro no alto da tela, nome da fase e a contagem
//    regressiva grande no meio.
//  - No passeio: no lugar do cronômetro, uma bússola apontando o marcador da
//    corrida (e quantas peças de tuning já foram pegas); dentro de um
//    marcador, o convite (correr, seguir viagem...).
//  - Sempre: avisos rápidos (peça encontrada, fase liberada).

/** Onde está um marcador, visto do carro (o Jogo calcula a cada quadro). */
export interface InfoMarcador {
  /** Distância (m) até o marcador. */
  distancia: number;
  /**
   * Para que lado ele fica, em radianos, em relação à frente do carro:
   * 0 = bem à frente, positivo = à direita, ±π = atrás.
   */
  direcao: number;
  /** O carro está dentro do anel do marcador? */
  dentro: boolean;
  /** Dentro do anel, mas rápido demais para começar (precisa frear). */
  rapido: boolean;
}

/** O texto do convite que aparece dentro de um marcador. */
export interface Convite {
  /** Linha pequena de cima ("🏁 CORRIDA"). */
  rotulo: string;
  /** O nome grande. */
  nome: string;
  /** Linha de detalhe (recorde, tempo-meta...). Pode ter HTML. */
  detalhe: string;
  /** O que fazer (pode ter HTML, como <kbd>Enter</kbd>). */
  acao: string;
}

/** Quanto tempo (s) um aviso fica na tela. */
const DURACAO_AVISO = 3.5;

export class HudCorrida {
  private readonly cronometro: HTMLElement;
  private readonly contagem: HTMLElement;
  private readonly titulo: HTMLElement;
  private readonly bussola: HTMLElement;
  private readonly seta: HTMLElement;
  private readonly distancia: HTMLElement;
  private readonly pecas: HTMLElement;
  private readonly convite: HTMLElement;
  private readonly aviso: HTMLElement;
  private textoContagem = '';
  /** Últimos textos escritos (mexer no HTML a cada quadro custa caro). */
  private textoDistancia = '';
  private textoConvite = '';
  private tempoAviso = 0;

  constructor(nome: string, local: string, recorde: number | null) {
    this.cronometro = criar('hud-cronometro');
    this.contagem = criar('hud-contagem');
    this.titulo = criar('hud-titulo-fase');
    const linhaRecorde = recorde === null ? '' : `<small>Recorde: ${formatarTempo(recorde)}</small>`;
    this.titulo.innerHTML = `<strong>${nome}</strong><span>${local}</span>${linhaRecorde}`;

    this.bussola = criar('hud-bussola');
    this.bussola.innerHTML =
      '<span class="hud-bussola-seta">▲</span><span>🏁 Corrida</span><b></b><span class="hud-bussola-pecas"></span>';
    this.seta = this.bussola.querySelector('.hud-bussola-seta') as HTMLElement;
    this.distancia = this.bussola.querySelector('b') as HTMLElement;
    this.pecas = this.bussola.querySelector('.hud-bussola-pecas') as HTMLElement;

    this.convite = criar('hud-convite');
    this.aviso = criar('hud-aviso');
    document.body.append(this.cronometro, this.contagem, this.titulo, this.bussola, this.convite, this.aviso);
  }

  atualizar(dt: number, estado: EstadoCorrida, tempo: number, restante: number): void {
    const passeando = estado === 'passeio';
    this.cronometro.style.display = passeando ? 'none' : '';
    this.bussola.style.display = passeando ? '' : 'none';
    if (!passeando) this.mostrarConvite(null);
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

    if (this.tempoAviso > 0) {
      this.tempoAviso -= dt;
      if (this.tempoAviso <= 0) this.aviso.classList.remove('visivel');
    }
  }

  /** No passeio: a seta e a distância até o marcador da corrida. */
  mostrarBussola(info: InfoMarcador): void {
    // A seta gira como um ponteiro: para cima = em frente.
    this.seta.style.transform = `rotate(${info.direcao}rad)`;
    this.seta.style.visibility = info.dentro ? 'hidden' : 'visible';
    const metros = info.dentro
      ? 'aqui!'
      : info.distancia < 1000
        ? `${Math.round(info.distancia)} m`
        : `${(info.distancia / 1000).toFixed(1).replace('.', ',')} km`;
    if (metros !== this.textoDistancia) {
      this.textoDistancia = metros;
      this.distancia.textContent = metros;
    }
  }

  /** O contador de peças ao lado da bússola (some se a fase não tem peças). */
  mostrarPecas(coletadas: number, total: number): void {
    this.pecas.textContent = total > 0 ? `🔧 ${coletadas}/${total}` : '';
  }

  /** Mostra (ou esconde, com null) o convite de um marcador. */
  mostrarConvite(convite: Convite | null): void {
    this.convite.classList.toggle('visivel', convite !== null);
    if (!convite) return;
    const html = `
      <div class="hud-convite-rotulo">${convite.rotulo}</div>
      <div class="hud-convite-nome">${convite.nome}</div>
      <div class="hud-convite-recorde">${convite.detalhe}</div>
      <div class="hud-convite-acao">${convite.acao}</div>`;
    if (html !== this.textoConvite) {
      this.textoConvite = html;
      this.convite.innerHTML = html;
    }
  }

  /** Um aviso rápido no meio da tela (peça encontrada, fase liberada...). Pode ter HTML. */
  avisar(html: string): void {
    this.aviso.innerHTML = html;
    this.aviso.classList.add('visivel');
    this.tempoAviso = DURACAO_AVISO;
  }

  /** Atualiza o recorde mostrado na largada (depois de uma corrida). */
  mostrarRecorde(recorde: number): void {
    const small = this.titulo.querySelector('small') ?? this.titulo.appendChild(document.createElement('small'));
    small.textContent = `Recorde: ${formatarTempo(recorde)}`;
  }
}

function criar(classe: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = classe;
  return div;
}
