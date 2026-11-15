import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { tuning } from '../config/tuning';

// =============================================================================
// VEÍCULO POR RAYCAST
// =============================================================================
// Por que raycast e não rodas de verdade (cilindros com juntas)?
// Rodas físicas de verdade quicam, travam em quinas da malha do chão e ficam
// instáveis em alta velocidade. No modelo por raycast, o carro é só uma caixa;
// de cada canto sai um "raio" para baixo que mede a distância até o chão. Essa
// distância diz o quanto a mola está comprimida, e a mola empurra a caixa para
// cima. O atrito do pneu é calculado no ponto onde o raio tocou o chão. É o
// mesmo método de muitos jogos de corrida arcade: estável e fácil de ajustar.
//
// Eixos do carro (espaço local): +Z é a frente, +Y é cima, +X é a ESQUERDA.
// =============================================================================

/** Onde fica cada roda, medido no modelo 3D (espaço local do carro). */
export interface GeometriaCarro {
  /** Centro de cada roda, na ordem: DE, DD, TE, TD. */
  rodas: [Vector3, Vector3, Vector3, Vector3];
  raioRoda: number;
  /** Caixa de colisão da carroceria (centro e meias-medidas). */
  centroCaixa: Vector3;
  meiasMedidas: Vector3;
}

/** O que o jogador está pedindo neste passo. */
export interface ComandosCarro {
  acelerar: boolean;
  frear: boolean;
  /** -1 (direita) a +1 (esquerda). */
  direcao: number;
  freioMao: boolean;
  nitro: boolean;
}

/** Estado de uma roda, para o visual desenhar. */
export interface EstadoRoda {
  comprimentoSuspensao: number;
  anguloDirecao: number; // ângulo das rodas dianteiras (rad)
  giro: number; // rotação acumulada no eixo (rad)
  noChao: boolean;
}

const DIANTEIRAS = [0, 1];
const TRASEIRAS = [2, 3];
const CIMA_LOCAL = new Vector3(0, 1, 0);
/** "Para cima" do mundo (igual a CIMA_LOCAL, mas nunca é girado). */
const CIMA_MUNDO = new Vector3(0, 1, 0);
const ESQUERDA_LOCAL = new Vector3(1, 0, 0);
const FRENTE_LOCAL = new Vector3(0, 0, 1);

export class VeiculoFisico {
  readonly corpo: RAPIER.RigidBody;
  private readonly colisor: RAPIER.Collider;
  private readonly controle: RAPIER.DynamicRayCastVehicleController;

  // Estado guardado entre passos.
  private anguloVolante = 0;
  /** 1 = aderência traseira normal; menor durante e logo após o freio de mão. */
  private fatorAderenciaTraseira = 1;
  private tempoCapotado = 0;

  /** Nitro restante (0 a 1). */
  nitro = 1;
  nitroLigado = false;
  derrapando = false;
  /** Intensidade da derrapagem (0 a 1), para fumaça e som dos pneus. */
  intensidadeDerrapagem = 0;
  /** O jogador está segurando o acelerador (para o som do motor). */
  acelerando = false;
  /** Pedido de reposicionamento (o carro capotou ou caiu). Quem decide para onde é o Jogo. */
  precisaReposicionar = false;
  /** Fora do asfalto? Quem sabe onde fica a pista é o Jogo, que liga isto. */
  naGrama = false;

  // Posição e rotação no passo anterior e no atual, para a interpolação.
  readonly posicaoAnterior = new Vector3();
  readonly rotacaoAnterior = new Quaternion();
  readonly posicaoAtual = new Vector3();
  readonly rotacaoAtual = new Quaternion();

  constructor(
    private readonly mundo: RAPIER.World,
    private readonly geometria: GeometriaCarro,
    posicaoInicial: Vector3,
    anguloInicial: number,
  ) {
    const rotacao = new Quaternion().setFromAxisAngle(CIMA_LOCAL, anguloInicial);
    this.corpo = mundo.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(posicaoInicial.x, posicaoInicial.y, posicaoInicial.z)
        .setRotation(rotacao)
        // CCD evita atravessar paredes finas em alta velocidade.
        .setCcdEnabled(true),
    );

    const { centroCaixa: c, meiasMedidas: m } = geometria;
    this.colisor = mundo.createCollider(
      RAPIER.ColliderDesc.cuboid(m.x, m.y, m.z)
        .setTranslation(c.x, c.y, c.z)
        // Atrito baixo na lataria: raspar no muro faz deslizar, não "agarrar".
        .setFriction(0.3)
        .setRestitution(0.1),
      this.corpo,
    );
    this.aplicarMassa();

    this.controle = mundo.createVehicleController(this.corpo);
    this.controle.indexUpAxis = 1; // Y
    this.controle.setIndexForwardAxis = 2; // Z (o nome estranho é da própria API do Rapier)

    for (const roda of geometria.rodas) {
      // O ponto de fixação fica acima do centro da roda, a uma distância igual
      // ao comprimento da mola: assim, com a mola em repouso, a roda física
      // fica exatamente onde a roda do modelo 3D está desenhada.
      this.controle.addWheel(
        { x: roda.x, y: roda.y + tuning.suspensao.comprimentoRepouso, z: roda.z },
        { x: 0, y: -1, z: 0 }, // a mola aponta para baixo
        { x: -1, y: 0, z: 0 }, // eixo da roda: -X faz o "para frente" do Rapier ser +Z
        tuning.suspensao.comprimentoRepouso,
        geometria.raioRoda,
      );
    }
    this.aplicarParametrosRodas();
    this.guardarEstado();
    this.posicaoAnterior.copy(this.posicaoAtual);
    this.rotacaoAnterior.copy(this.rotacaoAtual);
  }

  /**
   * Massa, centro de massa e inércia, calculados a partir do tuning.
   * Chamado de novo quando o painel F2 muda esses valores.
   */
  aplicarMassa(): void {
    const { massa, alturaCentroMassa, multiplicadorInercia } = tuning.chassi;
    const r = this.geometria.rodas;
    // Centro de massa entre os eixos (e não no centro da caixa): o Carro1, por
    // exemplo, tem a traseira bem comprida por causa do estepe.
    const zCentro = (r[0].z + r[2].z) / 2;
    const largura = this.geometria.meiasMedidas.x * 2;
    const altura = this.geometria.meiasMedidas.y * 2;
    const comprimento = this.geometria.meiasMedidas.z * 2;
    // Inércia de uma caixa maciça (fórmula de física), multiplicada pelo tuning.
    const k = (massa / 12) * multiplicadorInercia;
    this.colisor.setMassProperties(
      massa,
      { x: 0, y: alturaCentroMassa, z: zCentro },
      {
        x: k * (altura ** 2 + comprimento ** 2),
        y: k * (largura ** 2 + comprimento ** 2),
        z: k * (largura ** 2 + altura ** 2),
      },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    this.corpo.setLinearDamping(tuning.chassi.amortecimentoLinear);
    this.corpo.setAngularDamping(tuning.chassi.amortecimentoAngular);
  }

  /** Velocidade para a frente (m/s). Negativa de ré. */
  get velocidade(): number {
    return this.controle.currentVehicleSpeed();
  }

  /** Copia o estado atual para "anterior". Chamar antes de cada passo. */
  guardarEstadoAnterior(): void {
    this.posicaoAnterior.copy(this.posicaoAtual);
    this.rotacaoAnterior.copy(this.rotacaoAtual);
  }

  /** Um passo de física: lê os comandos e aplica forças. */
  atualizar(dt: number, comandos: ComandosCarro): void {
    this.acelerando = comandos.acelerar;
    this.nitroLigado = false; // religado em forcaParaFrente() se o jogador acelera com nitro
    this.aplicarParametrosRodas();
    this.atualizarDirecao(dt, comandos.direcao);
    this.atualizarMotorEFreios(dt, comandos);
    this.controle.updateVehicle(dt);
    this.aplicarBarraEstabilizadora(dt);
    this.aplicarDownforce(dt);
    this.aplicarArrastoGrama(dt);
    this.autoEndireitar(dt);
    this.medirDerrapagem();
    this.assistirDrift(dt);
    this.atualizarNitro(dt);
    this.verificarCapotado(dt);
  }

  /** Chamar DEPOIS do passo do mundo, para guardar onde o carro foi parar. */
  guardarEstado(): void {
    const p = this.corpo.translation();
    const q = this.corpo.rotation();
    this.posicaoAtual.set(p.x, p.y, p.z);
    this.rotacaoAtual.set(q.x, q.y, q.z, q.w);
  }

  estadoRoda(i: number): EstadoRoda {
    return {
      comprimentoSuspensao: this.controle.wheelSuspensionLength(i) ?? tuning.suspensao.comprimentoRepouso,
      anguloDirecao: this.controle.wheelSteering(i) ?? 0,
      giro: this.controle.wheelRotation(i) ?? 0,
      noChao: this.controle.wheelIsInContact(i),
    };
  }

  /** Coloca o carro parado, de pé, numa posição e direção. */
  reposicionar(posicao: Vector3, angulo: number): void {
    const q = new Quaternion().setFromAxisAngle(CIMA_LOCAL, angulo);
    this.corpo.setTranslation(posicao, true);
    this.corpo.setRotation(q, true);
    this.corpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.corpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.anguloVolante = 0;
    this.fatorAderenciaTraseira = 1;
    this.tempoCapotado = 0;
    this.precisaReposicionar = false;
    this.guardarEstado();
    // Sem isso, a interpolação "arrastaria" o carro da posição velha à nova.
    this.posicaoAnterior.copy(this.posicaoAtual);
    this.rotacaoAnterior.copy(this.rotacaoAtual);
  }

  /** Ponto onde a roda toca o chão (mundo), ou null se ela está no ar. */
  pontoContato(i: number): Vector3 | null {
    if (!this.controle.wheelIsInContact(i)) return null;
    const p = this.controle.wheelContactPoint(i);
    return p ? new Vector3(p.x, p.y, p.z) : null;
  }

  /** Alguma roda está no chão? */
  get noChao(): boolean {
    return [0, 1, 2, 3].some((i) => this.controle.wheelIsInContact(i));
  }

  /** Velocidade do carro como vetor (m/s, no mundo). */
  velocidadeLinear(): Vector3 {
    const v = this.corpo.linvel();
    return new Vector3(v.x, v.y, v.z);
  }

  /** Ângulo do carro em torno de Y (para onde ele aponta no plano). */
  get anguloHorizontal(): number {
    const frente = FRENTE_LOCAL.clone().applyQuaternion(this.rotacaoAtual);
    return Math.atan2(frente.x, frente.z);
  }

  destruir(): void {
    this.mundo.removeVehicleController(this.controle);
    this.mundo.removeRigidBody(this.corpo);
  }

  // ---------------------------------------------------------------------------

  /**
   * Repassa o tuning às rodas em todo passo. São poucas chamadas por passo, e
   * assim o painel F2 muda a suspensão ao vivo, sem precisar recriar o carro.
   */
  private aplicarParametrosRodas(): void {
    const s = tuning.suspensao;
    for (let i = 0; i < 4; i++) {
      this.controle.setWheelSuspensionRestLength(i, s.comprimentoRepouso);
      this.controle.setWheelMaxSuspensionTravel(i, s.cursoMaximo);
      this.controle.setWheelSuspensionStiffness(i, s.rigidez);
      this.controle.setWheelSuspensionCompression(i, s.amortecimentoCompressao);
      this.controle.setWheelSuspensionRelaxation(i, s.amortecimentoExtensao);
      this.controle.setWheelMaxSuspensionForce(i, s.forcaMaxima);
      this.controle.setWheelSideFrictionStiffness(i, tuning.aderencia.rigidezLateral);
    }
  }

  private atualizarDirecao(dt: number, pedido: number): void {
    const d = tuning.direcao;
    // Quanto mais rápido, menos o volante vira. Sem isso, a 180 km/h um toque
    // no A já jogaria o carro para fora da pista.
    const limite = d.anguloMaximo / (1 + Math.abs(this.velocidade) / d.velocidadeMeiaDirecao);
    const alvo = pedido * limite;
    // O volante não pula para o alvo: gira com velocidade limitada. Isso imita
    // as mãos do motorista e deixa o teclado (que é tudo ou nada) mais suave.
    const centralizando = Math.abs(alvo) < Math.abs(this.anguloVolante) || Math.sign(alvo) !== Math.sign(this.anguloVolante);
    const rapidez = centralizando ? d.velocidadeRetorno : d.velocidadeVolante;
    const passoMax = rapidez * dt;
    this.anguloVolante += Math.max(-passoMax, Math.min(passoMax, alvo - this.anguloVolante));
    for (const i of DIANTEIRAS) this.controle.setWheelSteering(i, this.anguloVolante);
  }

  private atualizarMotorEFreios(dt: number, c: ComandosCarro): void {
    const m = tuning.motor;
    const v = this.velocidade;

    // Decide o que cada pedal faz agora. O S freia enquanto o carro anda para
    // a frente e só vira ré quando ele quase parou (e o W ao contrário).
    let forcaMotor = 0;
    let forcaFreio = 0;
    if (c.acelerar && v > -1) {
      forcaMotor = this.forcaParaFrente(v, c.nitro);
    } else if (c.acelerar) {
      forcaFreio = tuning.freios.forca;
    } else if (c.frear && v > 1) {
      forcaFreio = tuning.freios.forca;
    } else if (c.frear) {
      forcaMotor = v > -m.velocidadeMaximaReKmh / 3.6 ? -m.forcaRe : 0;
    } else {
      forcaFreio = m.freioMotor;
    }

    // Freio de mão: trava a traseira e reduz a aderência dela. A aderência volta
    // aos poucos ao soltar, e é isso que deixa o drift controlável.
    const freioMaoTraseiro = c.freioMao ? tuning.freios.forcaFreioMao / 2 : 0;
    if (c.freioMao) {
      this.fatorAderenciaTraseira = tuning.drift.aderenciaTraseiraFreioMao;
    } else {
      const recuperacao = (1 - tuning.drift.aderenciaTraseiraFreioMao) / Math.max(tuning.drift.tempoRecuperacao, 0.01);
      this.fatorAderenciaTraseira = Math.min(1, this.fatorAderenciaTraseira + recuperacao * dt);
    }

    const traseira = m.distribuicaoTraseira;
    for (let i = 0; i < 4; i++) {
      const eTraseira = TRASEIRAS.includes(i);
      const parteMotor = (eTraseira ? traseira : 1 - traseira) / 2;
      // No Rapier, o freio é um impulso por passo (N·s), e não uma força (N).
      // Convertemos aqui para o tuning poder falar em Newtons.
      let impulsoFreio = (forcaFreio / 4) * dt;
      if (eTraseira) impulsoFreio += freioMaoTraseiro * dt;
      // Importante: o Rapier ignora o freio de uma roda que tem força de motor.
      // Por isso, com freio de mão, as traseiras ficam sem motor.
      const motorNestaRoda = eTraseira && c.freioMao ? 0 : forcaMotor * parteMotor;
      this.controle.setWheelEngineForce(i, motorNestaRoda);
      this.controle.setWheelBrake(i, impulsoFreio);
      const fatorGrama = this.naGrama ? tuning.grama.aderencia : 1;
      this.controle.setWheelFrictionSlip(
        i,
        fatorGrama * (eTraseira ? tuning.aderencia.traseira * this.fatorAderenciaTraseira : tuning.aderencia.dianteira),
      );
    }
  }

  /** Força do motor para a frente: forte parado, caindo até zero na velocidade máxima. */
  private forcaParaFrente(v: number, querNitro: boolean): number {
    const n = tuning.nitro;
    this.nitroLigado = querNitro && this.nitro > 0;
    const vMax = (tuning.motor.velocidadeMaximaKmh + (this.nitroLigado ? n.velocidadeExtraKmh : 0)) / 3.6;
    const fracao = Math.min(Math.max(v / vMax, 0), 1);
    // Curva cúbica: quase força total até uns 60% da máxima, depois cai rápido.
    // Dá arrancada forte e um teto de velocidade suave, sem "bater no muro".
    const forca = tuning.motor.forca * (1 - fracao ** 3);
    return this.nitroLigado ? forca * n.multiplicadorForca : forca;
  }

  /**
   * Barra estabilizadora: liga as molas esquerda e direita do mesmo eixo.
   * Quando um lado comprime mais que o outro (o carro está inclinando), ela
   * empurra o lado baixo para cima e o lado alto para baixo. Resultado: o carro
   * inclina menos e capota menos nas curvas, sem endurecer a suspensão.
   */
  private aplicarBarraEstabilizadora(dt: number): void {
    const cima = CIMA_LOCAL.clone().applyQuaternion(this.rotacaoDoCorpo());
    for (const [esq, dir] of [[0, 1], [2, 3]] as const) {
      if (!this.controle.wheelIsInContact(esq) || !this.controle.wheelIsInContact(dir)) continue;
      const compEsq = tuning.suspensao.comprimentoRepouso - (this.controle.wheelSuspensionLength(esq) ?? 0);
      const compDir = tuning.suspensao.comprimentoRepouso - (this.controle.wheelSuspensionLength(dir) ?? 0);
      const forca = (compEsq - compDir) * tuning.suspensao.barraEstabilizadora;
      const impulso = cima.clone().multiplyScalar(forca * dt);
      this.corpo.applyImpulseAtPoint(impulso, this.pontoDaRoda(esq), true);
      this.corpo.applyImpulseAtPoint(impulso.negate(), this.pontoDaRoda(dir), true);
    }
  }

  /**
   * Inclinado além do ângulo livre, o carro ganha um giro de volta para a
   * posição de pé, e o giro que o estava deitando é freado. Mexemos direto na
   * velocidade de giro (e não numa força) para o ajuste não depender da massa
   * do carro: o mesmo número serve para o carro 1 e o carro 2.
   */
  private autoEndireitar(dt: number): void {
    const e = tuning.estabilidade;
    if (e.forcaEndireitar <= 0) return;
    const giro = this.rotacaoDoCorpo();
    const cima = CIMA_LOCAL.clone().applyQuaternion(giro);
    const angulo = Math.acos(Math.min(1, Math.max(-1, cima.y)));
    const excesso = angulo - (e.anguloLivre * Math.PI) / 180;
    if (excesso <= 0) return;

    // Eixo em volta do qual "cima do carro" gira até "cima do mundo".
    const eixo = new Vector3().crossVectors(cima, CIMA_MUNDO);
    // De cabeça para baixo o eixo some (vetores opostos): gira pela frente.
    if (eixo.lengthSq() < 1e-6) eixo.copy(FRENTE_LOCAL).applyQuaternion(giro);
    eixo.normalize();

    const w = this.corpo.angvel();
    const giroAtual = new Vector3(w.x, w.y, w.z);
    const giroNoEixo = giroAtual.dot(eixo);
    const mudanca = (e.forcaEndireitar * excesso - e.amortecimento * giroNoEixo) * dt;
    giroAtual.addScaledVector(eixo, mudanca);
    this.corpo.setAngvel(giroAtual, true);
  }

  /**
   * Na grama o carro perde velocidade (como num jogo de corrida arcade): sair
   * da pista custa tempo, e quem sai rápido chega ao barranco já mais devagar.
   * Só freia no plano (X/Z): na vertical quem manda é a gravidade.
   */
  private aplicarArrastoGrama(dt: number): void {
    if (!this.naGrama) return;
    const algumaRodaNoChao = [0, 1, 2, 3].some((i) => this.controle.wheelIsInContact(i));
    if (!algumaRodaNoChao) return;
    const v = this.corpo.linvel();
    const fator = Math.min(1, tuning.grama.arrasto * dt) * this.corpo.mass();
    this.corpo.applyImpulse({ x: -v.x * fator, y: 0, z: -v.z * fator }, true);
  }

  /** Empurra o carro contra o chão, mais forte quanto mais rápido. */
  private aplicarDownforce(dt: number): void {
    const rodasNoChao = [0, 1, 2, 3].filter((i) => this.controle.wheelIsInContact(i)).length;
    if (rodasNoChao === 0) return; // no ar não tem "pressão aerodinâmica" útil
    const v = this.velocidade;
    const baixo = CIMA_LOCAL.clone().applyQuaternion(this.rotacaoDoCorpo()).multiplyScalar(-tuning.chassi.downforce * v * v * dt);
    this.corpo.applyImpulse(baixo, true);
  }

  private medirDerrapagem(): void {
    const vel = this.corpo.linvel();
    const esquerda = ESQUERDA_LOCAL.clone().applyQuaternion(this.rotacaoDoCorpo());
    const lateral = Math.abs(esquerda.dot(new Vector3(vel.x, vel.y, vel.z)));
    const algumaTraseiraNoChao = TRASEIRAS.some((i) => this.controle.wheelIsInContact(i));
    this.derrapando = algumaTraseiraNoChao && lateral > tuning.drift.velocidadeLateralMinima;
    // De 0 (no limite) a 1 (bem de lado). Os 8 m/s extras são só a escala do efeito.
    this.intensidadeDerrapagem = algumaTraseiraNoChao ? Math.min(1, Math.max(0, (lateral - tuning.drift.velocidadeLateralMinima) / 8)) : 0;
  }

  /**
   * Assistência de drift: o truque que separa "drift de jogo" de "rodar na pista".
   *
   * Na física pura, quando a traseira solta, o carro tende a girar até ficar de
   * ré; corrigir isso no teclado (que só tem "tudo ou nada") é quase impossível.
   * Duas ajudas, ambas reguláveis em tuning.drift:
   *  1. Limite de ângulo: se o carro já está muito de lado e continua girando
   *     para fora, freamos esse giro. Ele fica de lado, mas não roda.
   *  2. Alinhamento: durante o drift, a direção do movimento é puxada aos poucos
   *     para o nariz do carro, sem perder velocidade. Isso dá o "embalo" de sair
   *     da curva acelerando, típico de jogo arcade.
   */
  private assistirDrift(dt: number): void {
    const a = tuning.drift;
    const rodasNoChao = [0, 1, 2, 3].filter((i) => this.controle.wheelIsInContact(i)).length;
    if (rodasNoChao < 2) return; // no ar, a física manda

    const q = this.rotacaoDoCorpo();
    const frente = FRENTE_LOCAL.clone().applyQuaternion(q);
    const esquerda = ESQUERDA_LOCAL.clone().applyQuaternion(q);
    const cima = CIMA_LOCAL.clone().applyQuaternion(q);
    const lv = this.corpo.linvel();
    const vel = new Vector3(lv.x, lv.y, lv.z);
    const vFrente = vel.dot(frente);
    const vLado = vel.dot(esquerda);
    if (vFrente < 5) return; // devagar ou de ré: nada a ajudar

    // Ângulo de derrapagem: entre para onde o carro aponta e para onde ele vai.
    const beta = Math.atan2(vLado, vFrente);

    // 1) Limite de ângulo. Girar no sentido contrário ao de beta aumenta o ângulo.
    const av = this.corpo.angvel();
    const giro = new Vector3(av.x, av.y, av.z).dot(cima);
    if (Math.abs(beta) > a.anguloMaximo && beta * giro < 0) {
      const novoGiro = giro * Math.max(0, 1 - a.correcaoGiro * dt);
      this.corpo.setAngvel({ x: av.x + cima.x * (novoGiro - giro), y: av.y + cima.y * (novoGiro - giro), z: av.z + cima.z * (novoGiro - giro) }, true);
    }

    // 2) Alinhamento da velocidade (só durante o drift).
    if (this.derrapando && a.alinhamentoVelocidade > 0) {
      const giroVel = Math.sign(beta) * Math.min(Math.abs(beta), a.alinhamentoVelocidade * dt);
      const novoBeta = beta - giroVel;
      const rapidez = Math.hypot(vFrente, vLado);
      const novaVel = vel
        .addScaledVector(frente, rapidez * Math.cos(novoBeta) - vFrente)
        .addScaledVector(esquerda, rapidez * Math.sin(novoBeta) - vLado);
      this.corpo.setLinvel(novaVel, true);
    }
  }

  private atualizarNitro(dt: number): void {
    const n = tuning.nitro;
    if (this.nitroLigado) {
      this.nitro = Math.max(0, this.nitro - dt / n.duracao);
    } else {
      const recarga = n.recargaPassiva + (this.derrapando ? n.recargaDrift : 0);
      this.nitro = Math.min(1, this.nitro + recarga * dt);
    }
  }

  private verificarCapotado(dt: number): void {
    const cima = CIMA_LOCAL.clone().applyQuaternion(this.rotacaoDoCorpo());
    // Tombado = inclinado demais, mesmo que ainda escorregando. Antes exigíamos
    // "parado", e o carro deitado num barranco, deslizando, nunca voltava.
    const r = tuning.reposicionamento;
    const tombado = cima.y < Math.cos((r.inclinacaoTombado * Math.PI) / 180);
    this.tempoCapotado = tombado ? this.tempoCapotado + dt : 0;
    const caiu = this.corpo.translation().y < tuning.reposicionamento.alturaQueda;
    if (this.tempoCapotado > tuning.reposicionamento.tempoCapotado || caiu) {
      this.precisaReposicionar = true;
    }
  }

  private rotacaoDoCorpo(): Quaternion {
    const q = this.corpo.rotation();
    return new Quaternion(q.x, q.y, q.z, q.w);
  }

  /** Ponto de fixação da roda no mundo. */
  private pontoDaRoda(i: number): Vector3 {
    const p = this.controle.wheelHardPoint(i);
    return p ? new Vector3(p.x, p.y, p.z) : new Vector3().copy(this.corpo.translation());
  }
}
