import './hud.css';
import type { Marcha } from '../physics/Transmissao';

// HUD arcade: conta-giros redondo, velocímetro digital, marcha e nitro.
//
// Feito com HTML + SVG por cima do canvas, e não dentro da cena 3D: texto e
// formas vetoriais ficam nítidos em qualquer resolução e são fáceis de estilizar
// no hud.css, sem mexer em código.

export interface EstadoHud {
  velocidadeMs: number;
  rpm: number;
  rpmMaximo: number;
  marcha: Marcha;
  nitro: number; // 0 a 1
  nitroLigado: boolean;
  derrapando: boolean;
  camera: string;
}

/** Arco do conta-giros: de 225° a -45° (270° de abertura, sentido horário). */
const ANGULO_INICIAL = 225;
const ABERTURA = 270;
const CENTRO = { x: 120, y: 110 };
const RAIO = 92;
/** Fração do giro máximo onde começa a faixa vermelha. */
const INICIO_FAIXA_VERMELHA = 0.85;

export class Hud {
  private readonly arcoGiro: SVGPathElement;
  private readonly ponteiro: SVGLineElement;
  private readonly velocidade: HTMLElement;
  private readonly marcha: HTMLElement;
  private readonly nitro: HTMLElement;
  private readonly nivelNitro: HTMLElement;
  private readonly drift: HTMLElement;
  private readonly dicas: HTMLElement;
  private rpmMaximoDesenhado = 0;
  private cameraDesenhada = '';
  private aPe = false;
  private readonly painel: HTMLElement;

  constructor() {
    this.painel = document.createElement('div');
    this.painel.className = 'hud';
    this.painel.innerHTML = `
      <div class="hud-mostrador">
        <svg viewBox="0 0 240 200" aria-hidden="true">
          <circle class="hud-fundo" cx="${CENTRO.x}" cy="${CENTRO.y}" r="${RAIO + 14}" />
          <path class="hud-trilho" />
          <path class="hud-faixa-vermelha" />
          <path class="hud-giro" />
          <g class="hud-marcas"></g>
          <line class="hud-ponteiro" x1="${CENTRO.x}" y1="${CENTRO.y}" x2="${CENTRO.x}" y2="${CENTRO.y - RAIO + 6}" />
        </svg>
        <div class="hud-velocidade"><span>0</span><span class="hud-unidade">km/h</span></div>
        <div class="hud-marcha">N</div>
      </div>
      <div class="hud-nitro">
        <div class="hud-nitro-rotulo">NITRO</div>
        <div class="hud-nitro-barra"><div class="hud-nitro-nivel"></div></div>
      </div>`;
    document.body.appendChild(this.painel);

    const q = <T extends Element>(seletor: string): T => {
      const el = this.painel.querySelector<T>(seletor);
      if (!el) throw new Error(`HUD: elemento ${seletor} não encontrado`);
      return el;
    };
    this.arcoGiro = q('.hud-giro');
    this.ponteiro = q('.hud-ponteiro');
    this.velocidade = q('.hud-velocidade span');
    this.marcha = q('.hud-marcha');
    this.nitro = q('.hud-nitro');
    this.nivelNitro = q('.hud-nitro-nivel');

    this.drift = document.createElement('div');
    this.drift.className = 'hud-drift';
    this.drift.textContent = 'DRIFT!';
    this.dicas = document.createElement('div');
    this.dicas.className = 'hud-dicas';
    document.body.append(this.drift, this.dicas);
  }

  atualizar(e: EstadoHud): void {
    if (e.rpmMaximo !== this.rpmMaximoDesenhado) this.desenharEscala(e.rpmMaximo);

    const fracao = Math.min(Math.max(e.rpm / e.rpmMaximo, 0), 1);
    this.arcoGiro.setAttribute('d', arco(ANGULO_INICIAL, ANGULO_INICIAL - ABERTURA * fracao));
    this.arcoGiro.classList.toggle('no-limite', fracao >= INICIO_FAIXA_VERMELHA);
    // O ponteiro foi desenhado apontando para cima (90°); giramos a diferença.
    this.ponteiro.setAttribute('transform', `rotate(${90 - (ANGULO_INICIAL - ABERTURA * fracao)} ${CENTRO.x} ${CENTRO.y})`);

    this.velocidade.textContent = String(Math.round(Math.abs(e.velocidadeMs) * 3.6));
    this.marcha.textContent = String(e.marcha);
    this.nivelNitro.style.transform = `scaleX(${e.nitro})`;
    this.nitro.classList.toggle('ligado', e.nitroLigado);
    this.drift.classList.toggle('visivel', e.derrapando && !this.aPe);
    if (e.camera !== this.cameraDesenhada) this.desenharDicas(e.camera);
  }

  /** A pé: esconde velocímetro e nitro (são do carro) e troca as dicas de teclas. */
  mostrarAPe(aPe: boolean): void {
    if (aPe === this.aPe) return;
    this.aPe = aPe;
    this.painel.classList.toggle('a-pe', aPe);
    if (aPe) this.drift.classList.remove('visivel');
    this.desenharDicas(this.cameraDesenhada);
  }

  /** Só redesenha as dicas quando algo muda (mexer no HTML a cada quadro custa caro). */
  private desenharDicas(camera: string): void {
    this.cameraDesenhada = camera;
    if (this.aPe) {
      this.dicas.innerHTML =
        `A pé &nbsp;·&nbsp; <kbd>W</kbd>/<kbd>S</kbd> andar &nbsp;<kbd>A</kbd>/<kbd>D</kbd> virar &nbsp;<kbd>Shift</kbd> correr &nbsp;` +
        `<kbd>Espaço</kbd> pular &nbsp;<kbd>E</kbd> entrar num carro &nbsp;<kbd>R</kbd> voltar ao carro &nbsp;<kbd>Esc</kbd> pausar`;
      return;
    }
    this.dicas.innerHTML =
      `Câmera: ${camera} &nbsp;·&nbsp; <kbd>C</kbd> câmera &nbsp;<kbd>R</kbd> reposicionar &nbsp;<kbd>T</kbd> correr da largada &nbsp;<kbd>E</kbd> descer &nbsp;` +
      `<kbd>Esc</kbd> pausar &nbsp;<kbd>F2</kbd> tuning`;
  }

  /** Desenha o trilho, a faixa vermelha e os números (1, 2, 3... mil rpm). */
  private desenharEscala(rpmMaximo: number): void {
    this.rpmMaximoDesenhado = rpmMaximo;
    const fim = ANGULO_INICIAL - ABERTURA;
    const inicioVermelho = ANGULO_INICIAL - ABERTURA * INICIO_FAIXA_VERMELHA;
    this.painel.querySelector('.hud-trilho')?.setAttribute('d', arco(ANGULO_INICIAL, fim));
    this.painel.querySelector('.hud-faixa-vermelha')?.setAttribute('d', arco(inicioVermelho, fim));

    const marcas = this.painel.querySelector('.hud-marcas');
    if (!marcas) return;
    let svg = '';
    for (let mil = 0; mil * 1000 <= rpmMaximo; mil++) {
      const a = ANGULO_INICIAL - ABERTURA * ((mil * 1000) / rpmMaximo);
      const [x1, y1] = ponto(a, RAIO - 9);
      const [x2, y2] = ponto(a, RAIO - 17);
      const [xt, yt] = ponto(a, RAIO - 28);
      svg += `<line class="hud-marca" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
      svg += `<text class="hud-numero" x="${xt}" y="${yt}">${mil}</text>`;
    }
    marcas.innerHTML = svg;
  }
}

/** Ponto na circunferência do mostrador. Ângulo em graus, 0° = direita, sentido anti-horário. */
function ponto(graus: number, raio: number): [number, number] {
  const rad = (graus * Math.PI) / 180;
  return [+(CENTRO.x + Math.cos(rad) * raio).toFixed(2), +(CENTRO.y - Math.sin(rad) * raio).toFixed(2)];
}

/** Caminho SVG de um arco entre dois ângulos (no sentido horário). */
function arco(de: number, ate: number): string {
  const [x1, y1] = ponto(de, RAIO);
  const [x2, y2] = ponto(ate, RAIO);
  const grande = de - ate > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RAIO} ${RAIO} 0 ${grande} 1 ${x2} ${y2}`;
}
