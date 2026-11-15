import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';
import type { IdModelo } from './assets';
import type { MundoFisico } from '../physics/MundoFisico';
import type { Tracado } from './Tracado';

/** Tamanho de um tipo de veículo (metade de cada medida, em metros). */
export interface MeiasMedidas {
  x: number;
  y: number;
  z: number;
}

/** Tempo máximo (s) tombando a moto atingida (se algo a segurar, desiste). */
const TEMPO_MAXIMO_TOMBANDO = 1.5;
/** "Deitada": o eixo de cima da moto já está tão inclinado (cosseno ~70°). */
const DEITADA = 0.35;

/** Sentido em que o veículo anda: +1 = da largada para a chegada; −1 = contramão. */
export type Sentido = 1 | -1;

/**
 * Um carro, ônibus ou moto do trânsito.
 *
 * Enquanto ninguém encosta, ele não tem física de verdade (rodas, motor,
 * atrito): anda "sobre trilhos" pela faixa dele, a uma velocidade que o
 * próprio código controla. Assim o trânsito nunca sai da pista nem capota
 * sozinho, e custa quase nada para o processador.
 *
 * Quando o jogador (ou um destroço) vai bater nele, ele é "solto": vira um
 * corpo dinâmico com peso de verdade, e a física cuida do resto (voar,
 * rodar, tombar, ser empurrado). Ver soltar().
 */
export class VeiculoTrafego {
  /** Metros desde o início do traçado. */
  distancia: number;
  /** Velocidade atual (m/s), sempre positiva; o sentido diz para onde. */
  velocidade: number;
  /** Chegou ao fim do trecho de trânsito e ficou esperando para sumir. */
  noFim = false;
  /** Levou uma batida: agora quem move é a física (ver soltar). */
  solto = false;
  /** Faixa em que ele anda (m do centro da pista; + = esquerda). */
  readonly lateral: number;
  /** Onde ele está de fato (um veículo solto pode ter escorregado para outra faixa). */
  lateralAtual: number;
  /** Velocidade ao longo da pista (m/s): + indo para a chegada, − para a largada. */
  velocidadeNaPista: number;
  private dica: number | undefined;
  /** Moto atingida: segundos que ainda falta "empurrar" o tombo, e para que lado. */
  private tempoTombando = 0;
  private ladoTombo = 1;

  private readonly posAnterior = new Vector3();
  private readonly posAtual = new Vector3();
  private readonly rotAnterior = new Quaternion();
  private readonly rotAtual = new Quaternion();

  constructor(
    readonly modelo: IdModelo,
    readonly objeto: Object3D,
    readonly corpo: RAPIER.RigidBody,
    readonly meias: MeiasMedidas,
    private readonly tracado: Tracado,
    distancia: number,
    readonly sentido: Sentido,
    /** Velocidade (m/s) que o motorista gosta de manter quando a pista está livre. */
    readonly cruzeiro: number,
    private readonly limites: [inicio: number, fim: number],
  ) {
    this.distancia = distancia;
    this.velocidade = cruzeiro;
    // No Brasil se anda pela direita: cada sentido tem sua faixa, no meio dela.
    const meiaFaixa = tracado.pista.largura / 4;
    this.lateral = sentido === 1 ? -meiaFaixa : meiaFaixa;
    this.lateralAtual = this.lateral;
    this.velocidadeNaPista = sentido * cruzeiro;
    this.calcularPose(this.posAtual, this.rotAtual);
    this.posAnterior.copy(this.posAtual);
    this.rotAnterior.copy(this.rotAtual);
    corpo.setTranslation(this.posAtual, true);
    corpo.setRotation(this.rotAtual, true);
  }

  /**
   * Um passo de física.
   * `folga`: metros livres até o obstáculo da frente (outro veículo ou o jogador).
   * `velocidadeDaFrente`: com que velocidade esse obstáculo anda no MEU sentido
   * (negativa = vindo na minha direção).
   */
  passo(dt: number, folga: number, velocidadeDaFrente: number): void {
    if (this.solto) {
      this.acompanharFisica(dt);
      return;
    }
    const t = tuning.trafego;

    // "Piloto automático adaptativo", como nos carros modernos: com a pista
    // livre, mantém a velocidade de cruzeiro; chegando perto de alguém, anda
    // no ritmo dele; colado demais, para.
    let alvo = this.noFim ? 0 : this.cruzeiro;
    const folgaDesejada = t.folgaMinima + this.velocidade * t.tempoSeguranca;
    if (folga < t.folgaMinima) alvo = 0;
    else if (folga < folgaDesejada) alvo = Math.min(alvo, Math.max(0, velocidadeDaFrente));

    let frenagem = t.frenagem;
    // Freada de emergência: se a frenagem normal não der tempo de parar
    // antes do obstáculo, freia mais forte (v² = 2·a·d).
    const espaco = folga - t.folgaMinima / 2;
    if (alvo < this.velocidade && espaco > 0.1) frenagem = Math.max(frenagem, (this.velocidade * this.velocidade) / (2 * espaco));
    if (espaco <= 0.1 && alvo < this.velocidade) frenagem = 1000;

    if (this.velocidade < alvo) this.velocidade = Math.min(alvo, this.velocidade + t.aceleracao * dt);
    else this.velocidade = Math.max(alvo, this.velocidade - frenagem * dt);

    this.distancia += this.sentido * this.velocidade * dt;
    this.velocidadeNaPista = this.sentido * this.velocidade;
    // Fim do trecho (perto das barreiras das pontas): para e espera sumir.
    const [inicio, fim] = this.limites;
    if (this.distancia > fim || this.distancia < inicio) {
      this.distancia = Math.min(Math.max(this.distancia, inicio), fim);
      this.noFim = true;
      this.velocidade = 0;
    }

    this.posAnterior.copy(this.posAtual);
    this.rotAnterior.copy(this.rotAtual);
    this.calcularPose(this.posAtual, this.rotAtual);
    // Cinemático: dizemos onde ele estará no fim do passo. O Rapier calcula
    // a velocidade a partir disso, e é ela que empurra o carro do jogador.
    this.corpo.setNextKinematicTranslation(this.posAtual);
    this.corpo.setNextKinematicRotation(this.rotAtual);
  }

  /**
   * Vira corpo dinâmico. O peso vem do tamanho (tuning.trafego.densidade).
   * Motos e lambretas ganham um giro de lado: atingidas, elas tombam.
   */
  soltar(fisica: MundoFisico, duasRodas: boolean): void {
    if (this.solto) return;
    this.solto = true;
    const t = tuning.trafego;
    const volume = 8 * this.meias.x * this.meias.y * this.meias.z;
    const frente = new Vector3(0, 0, 1).applyQuaternion(this.rotAtual);
    fisica.soltarVeiculo(this.corpo, volume * t.densidade, t.atritoAposBatida, t.arrastoAposBatida, frente.multiplyScalar(this.velocidade));
    // Moto e lambreta tombam para um lado sorteado (ver tombar()).
    if (duasRodas) {
      this.ladoTombo = Math.random() < 0.5 ? -1 : 1;
      this.tempoTombando = TEMPO_MAXIMO_TOMBANDO;
    }
  }

  /**
   * Uma moto parada em pé é uma caixa alta e estreita: a física sozinha a
   * deixaria de pé (o giro de uma batida some quando a borda do pneu bate no
   * chão). Então, por um instante, nós mesmos giramos a moto para o lado,
   * em volta do eixo dela (frente-trás), até ela deitar.
   */
  private tombar(dt: number): void {
    this.tempoTombando -= dt;
    const cima = new Vector3(0, 1, 0).applyQuaternion(this.rotAtual);
    if (cima.y < DEITADA) {
      this.tempoTombando = 0; // já deitou: daqui em diante é só física
      return;
    }
    const giro = new Vector3(0, 0, this.ladoTombo * tuning.trafego.tombarDuasRodas).applyQuaternion(this.rotAtual);
    this.corpo.setAngvel(giro, true);
  }

  /** Solto: a posição vem da física, e medimos onde ele está na pista (para os outros desviarem/frearem). */
  private acompanharFisica(dt: number): void {
    if (this.tempoTombando > 0) this.tombar(dt);
    this.posAnterior.copy(this.posAtual);
    this.rotAnterior.copy(this.rotAtual);
    const p = this.corpo.translation();
    const r = this.corpo.rotation();
    this.posAtual.set(p.x, p.y, p.z);
    this.rotAtual.set(r.x, r.y, r.z, r.w);
    const proj = this.tracado.projetar(this.posAtual, this.dica);
    this.dica = proj.indice;
    this.distancia = proj.distancia;
    this.lateralAtual = proj.lateral;
    const v = this.corpo.linvel();
    const tangente = this.tracado.tangentes[proj.indice];
    this.velocidadeNaPista = v.x * tangente.x + v.z * tangente.z;
    this.velocidade = Math.abs(this.velocidadeNaPista);
  }

  /** Desenha entre o passo anterior e o atual (mesma interpolação do carro do jogador). */
  desenhar(alfa: number): void {
    this.objeto.position.lerpVectors(this.posAnterior, this.posAtual, alfa);
    this.objeto.quaternion.slerpQuaternions(this.rotAnterior, this.rotAtual, alfa);
  }

  /**
   * O ponto `p` (o centro de outro veículo) está a ponto de encostar em mim?
   * `folgaLado`/`folgaFrente`: meia largura/meio comprimento do outro, mais
   * uma margem. A conta é feita "do meu ponto de vista" (eixos do veículo).
   */
  encostou(p: Vector3, folgaLado: number, folgaFrente: number): boolean {
    const local = p.clone().sub(this.posAtual).applyQuaternion(this.rotAtual.clone().invert());
    // y medido a partir do meio da caixa (a origem do veículo fica no chão).
    return Math.abs(local.x) < this.meias.x + folgaLado && Math.abs(local.z) < this.meias.z + folgaFrente && Math.abs(local.y - this.meias.y) < this.meias.y + 1.5;
  }

  /** Posição atual (no chão, embaixo do meio do veículo). */
  get posicao(): Vector3 {
    return this.posAtual;
  }

  /**
   * Posição e rotação na faixa. A rotação acompanha a subida/descida E a
   * inclinação lateral da curva: medimos a pista um pouco à frente/atrás e um
   * pouco para cada lado, e montamos os eixos do veículo com essas direções.
   */
  private calcularPose(posicao: Vector3, rotacao: Quaternion): void {
    const t = this.tracado;
    const d = this.distancia;
    t.posicaoEm(d, this.lateral, posicao);
    const frente = t.posicaoEm(d + 1.5, this.lateral).sub(t.posicaoEm(d - 1.5, this.lateral)).multiplyScalar(this.sentido).normalize();
    const esquerda = t.posicaoEm(d, this.lateral + 1).sub(t.posicaoEm(d, this.lateral - 1)).multiplyScalar(this.sentido).normalize();
    // Eixos do modelo: X = esquerda, Y = cima, Z = frente (a convenção do jogo).
    const cima = new Vector3().crossVectors(frente, esquerda).normalize();
    esquerda.crossVectors(cima, frente).normalize();
    rotacao.setFromRotationMatrix(new Matrix4().makeBasis(esquerda, cima, frente));
  }
}
