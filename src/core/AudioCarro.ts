// =============================================================================
// SOM DO CARRO, 100% SINTETIZADO (Web Audio API, sem arquivos de áudio)
// =============================================================================
// A Web Audio funciona como um pedal de guitarra: ligamos "nós" com cabos.
//   osciladores (geram onda) -> distorção -> filtro -> volume -> alto-falante
//
// Motor: um motor de 4 cilindros explode 2 vezes por volta do virabrequim.
// Então a 3000 rpm são 3000/60 × 2 = 100 explosões por segundo = 100 Hz. Uma
// onda "dente de serra" nessa frequência, com um pouco de distorção e um
// filtro que abre quando aceleramos, já soa como motor.
//
// Pneu: derrapagem é basicamente chiado (ruído branco) filtrado em volta de
// 1 kHz, com o volume proporcional ao quanto o carro está de lado.
//
// Regra dos navegadores: som só pode começar depois de o jogador apertar uma
// tecla ou clicar. Por isso existe `iniciar()`.
// =============================================================================

/** Volume geral (0 a 1). */
const VOLUME_GERAL = 0.5;
/** Explosões por volta do motor (4 cilindros, 4 tempos = 2). */
const EXPLOSOES_POR_VOLTA = 2;
/** Tempo (s) que os volumes e filtros levam para seguir um novo valor. Evita estalos. */
const SUAVIZACAO = 0.05;

export interface EstadoSom {
  rpm: number;
  rpmMaximo: number;
  /** Acelerador pressionado: motor "fazendo força" soa mais alto e aberto. */
  acelerando: boolean;
  /** Derrapagem dos pneus (0 a 1). */
  derrapagem: number;
  nitro: boolean;
}

export class AudioCarro {
  private ctx: AudioContext | null = null;
  private motor: { osciladores: OscillatorNode[]; filtro: BiquadFilterNode; volume: GainNode } | null = null;
  private pneu: GainNode | null = null;
  private nitro: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private saida: GainNode | null = null;
  /** Até quando (tempo do áudio) a troca de marcha controla o volume do motor. */
  private fimDaTroca = 0;

  /** Cria todo o circuito de som. Chamar após a primeira tecla do jogador. */
  iniciar(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.saida = ctx.createGain();
    this.saida.gain.value = VOLUME_GERAL;
    this.saida.connect(ctx.destination);
    this.ruido = criarRuido(ctx);
    this.motor = this.criarMotor(ctx, this.saida);
    this.pneu = this.criarChiado(ctx, this.saida, 1000, 1.2);
    this.nitro = this.criarChiado(ctx, this.saida, 3500, 0.6);
  }

  pausar(): void {
    void this.ctx?.suspend();
  }

  retomar(): void {
    void this.ctx?.resume();
  }

  atualizar(e: EstadoSom): void {
    const ctx = this.ctx;
    if (!ctx || !this.motor || !this.pneu || !this.nitro) return;
    const agora = ctx.currentTime;
    const frequencia = (e.rpm / 60) * EXPLOSOES_POR_VOLTA;
    const [base, sub, harmonico] = this.motor.osciladores;
    base.frequency.setTargetAtTime(frequencia, agora, SUAVIZACAO);
    sub.frequency.setTargetAtTime(frequencia / 2, agora, SUAVIZACAO);
    harmonico.frequency.setTargetAtTime(frequencia * 2, agora, SUAVIZACAO);

    // Acelerando, o filtro abre (som mais "rasgado") e o volume sobe.
    const giro = e.rpm / e.rpmMaximo;
    const corte = 300 + giro * 1800 + (e.acelerando ? 1400 : 0);
    this.motor.filtro.frequency.setTargetAtTime(corte, agora, SUAVIZACAO);
    if (agora > this.fimDaTroca) {
      this.motor.volume.gain.setTargetAtTime((e.acelerando ? 0.22 : 0.12) + giro * 0.1, agora, SUAVIZACAO);
    }

    this.pneu.gain.setTargetAtTime(e.derrapagem * 0.35, agora, SUAVIZACAO);
    this.nitro.gain.setTargetAtTime(e.nitro ? 0.18 : 0, agora, 0.08);
  }

  /** Efeito de troca de marcha: o motor "engasga" um instante. */
  trocaDeMarcha(subiu: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.motor || !this.saida || !this.ruido) return;
    const agora = ctx.currentTime;
    const volume = this.motor.volume.gain;
    // Corta o volume rápido e devolve: é a "respirada" entre uma marcha e outra.
    volume.cancelScheduledValues(agora);
    volume.setTargetAtTime(0.03, agora, 0.015);
    volume.setTargetAtTime(0.2, agora + 0.09, 0.04);
    this.fimDaTroca = agora + 0.15;
    if (subiu) this.soproTurbo(ctx, this.saida, this.ruido, agora);
  }

  /**
   * Bipe da contagem regressiva: grave no 3, 2, 1 e agudo no "VAI!".
   * Uma onda senoidal pura com volume que cai rápido: o som de semáforo de corrida.
   */
  bip(agudo: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.saida) return;
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = agudo ? 1320 : 660;
    const volume = ctx.createGain();
    const duracao = agudo ? 0.6 : 0.25;
    volume.gain.setValueAtTime(0.35, agora);
    volume.gain.exponentialRampToValueAtTime(0.001, agora + duracao);
    osc.connect(volume).connect(this.saida);
    osc.start(agora);
    osc.stop(agora + duracao);
  }

  /**
   * Som de batida, montado na hora (não há arquivo de áudio):
   * - um "tum" grave: uma onda senoidal que despenca de tom, o corpo da pancada;
   * - um estalo de ruído filtrado: a lataria (metal), o plástico, ou um
   *   "puf" abafado (macio: alguém sendo derrubado).
   * `intensidade` de 0 a 1 controla o volume e quanto o estalo dura.
   */
  batida(intensidade: number, material: 'metal' | 'plastico' | 'macio'): void {
    const ctx = this.ctx;
    if (!ctx || !this.saida || !this.ruido || intensidade <= 0) return;
    const agora = ctx.currentTime;
    const metal = material === 'metal';
    const macio = material === 'macio';
    const volume = (0.25 + 0.75 * intensidade) * (macio ? 0.6 : 1);

    const tum = ctx.createOscillator();
    tum.type = 'sine';
    tum.frequency.setValueAtTime(metal ? 120 : macio ? 90 : 260, agora);
    tum.frequency.exponentialRampToValueAtTime(metal ? 40 : macio ? 45 : 120, agora + 0.25);
    const volTum = ctx.createGain();
    volTum.gain.setValueAtTime(volume * (metal || macio ? 0.9 : 0.35), agora);
    volTum.gain.exponentialRampToValueAtTime(0.001, agora + 0.3);
    tum.connect(volTum).connect(this.saida);
    tum.start(agora);
    tum.stop(agora + 0.32);

    // Metal: ruído médio-grave e mais longo (chacoalha). Plástico: agudo e curto ("toc").
    const duracao = metal ? 0.18 + 0.35 * intensidade : 0.12;
    const estalo = ctx.createBufferSource();
    estalo.buffer = this.ruido;
    const filtro = ctx.createBiquadFilter();
    // Macio: só os graves do ruído (lowpass), como um saco caindo.
    filtro.type = macio ? 'lowpass' : 'bandpass';
    filtro.frequency.value = metal ? 900 : macio ? 350 : 2200;
    filtro.Q.value = metal ? 0.8 : macio ? 0.7 : 2.5;
    const volEstalo = ctx.createGain();
    volEstalo.gain.setValueAtTime(volume * (metal ? 0.8 : 0.4), agora);
    volEstalo.gain.exponentialRampToValueAtTime(0.001, agora + duracao);
    // Começa num ponto sorteado do ruído: duas batidas seguidas não soam idênticas.
    estalo.connect(filtro).connect(volEstalo).connect(this.saida);
    estalo.start(agora, Math.random() * 1.5);
    estalo.stop(agora + duracao + 0.02);
  }

  // ---------------------------------------------------------------------------

  private criarMotor(ctx: AudioContext, destino: AudioNode) {
    const mistura = ctx.createGain();
    // Três ondas: a principal, uma oitava abaixo (o "ronco") e uma acima (o "zumbido").
    const formas: [OscillatorType, number][] = [
      ['sawtooth', 0.5],
      ['square', 0.35],
      ['sawtooth', 0.15],
    ];
    const osciladores = formas.map(([tipo, volume]) => {
      const osc = ctx.createOscillator();
      osc.type = tipo;
      const g = ctx.createGain();
      g.gain.value = volume;
      osc.connect(g).connect(mistura);
      osc.start();
      return osc;
    });
    osciladores[2].detune.value = 8; // leve desafinação: som menos "de videogame antigo"

    const distorcao = ctx.createWaveShaper();
    distorcao.curve = curvaDistorcao(4);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 2;
    const volume = ctx.createGain();
    volume.gain.value = 0;
    mistura.connect(distorcao).connect(filtro).connect(volume).connect(destino);
    return { osciladores, filtro, volume };
  }

  /** Ruído branco passando por um filtro de banda: base do chiado de pneu e do nitro. */
  private criarChiado(ctx: AudioContext, destino: AudioNode, frequencia: number, q: number): GainNode {
    const fonte = ctx.createBufferSource();
    fonte.buffer = this.ruido;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = frequencia;
    filtro.Q.value = q;
    const volume = ctx.createGain();
    volume.gain.value = 0;
    fonte.connect(filtro).connect(volume).connect(destino);
    fonte.start();
    return volume;
  }

  /** "Psssh" curto de alívio do turbo ao subir a marcha. */
  private soproTurbo(ctx: AudioContext, destino: AudioNode, ruido: AudioBuffer, quando: number): void {
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'highpass';
    filtro.frequency.value = 2500;
    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.12, quando);
    volume.gain.exponentialRampToValueAtTime(0.001, quando + 0.3);
    fonte.connect(filtro).connect(volume).connect(destino);
    fonte.start(quando);
    fonte.stop(quando + 0.35);
  }
}

/** 2 segundos de ruído branco (valores aleatórios), tocado em repetição. */
function criarRuido(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Curva de distorção suave: achata os picos da onda, deixando o som "sujo". */
function curvaDistorcao(intensidade: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curva[i] = Math.tanh(intensidade * x) / Math.tanh(intensidade);
  }
  return curva;
}
