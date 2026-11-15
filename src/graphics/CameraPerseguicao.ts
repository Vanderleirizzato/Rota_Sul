import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { tuning } from '../config/tuning';

export type ModoCamera = 'perseguicao' | 'longe' | 'capo';
const MODOS: ModoCamera[] = ['perseguicao', 'longe', 'capo'];
/** Nome de cada câmera para mostrar na tela. */
export const NOMES_CAMERA: Record<ModoCamera, string> = { perseguicao: 'perseguição', longe: 'longe', capo: 'capô' };

/** Posição da câmera de capô no carro (m). Questão de enquadramento, não de jogabilidade. */
const CAPO = { altura: 1.4, frente: 0.3 };

/**
 * Câmera que segue o carro com inércia.
 *
 * Por que não grudar a câmera no carro? Porque ela trepidaria junto com a
 * suspensão e giraria de uma vez em cada drift, enjoando o jogador. Aqui ela
 * "corre atrás" da posição ideal com uma suavização exponencial: chega rápido
 * quando está longe e devagar quando está perto, como um cinegrafista.
 */
export class CameraPerseguicao {
  readonly camera: PerspectiveCamera;
  modo: ModoCamera = 'perseguicao';
  /**
   * Seguindo o personagem a pé (e não o carro): fica mais perto e mais baixa.
   * A pé não existe câmera de capô; ela vira a de perseguição.
   */
  aPe = false;
  private anguloSuave = 0;
  private fovAtual = tuning.camera.fovBase;
  private iniciada = false;
  /** Força do tremor de batida (0 a 1); vai sumindo sozinho. */
  private tremor = 0;
  /** Deslocamento do tremor aplicado no quadro anterior (é desfeito antes de recalcular). */
  private readonly deslocamentoTremor = new Vector3();

  constructor(proporcao: number) {
    this.camera = new PerspectiveCamera(tuning.camera.fovBase, proporcao, 0.1, 2000);
  }

  proximoModo(): void {
    this.modo = MODOS[(MODOS.indexOf(this.modo) + 1) % MODOS.length];
  }

  /**
   * Faz a câmera tremer (batida). O tremor é um deslocamento aleatório que
   * diminui a cada quadro. Ele é somado DEPOIS da suavização e desfeito no
   * quadro seguinte: se entrasse na posição "de verdade", a inércia da câmera
   * o espalharia num balanço lento, em vez de um sacolejo rápido.
   */
  tremer(intensidade: number): void {
    this.tremor = Math.min(1, Math.max(this.tremor, intensidade));
  }

  /** Teleporta a câmera para trás do carro (após reposicionar, por exemplo). */
  reiniciar(): void {
    this.iniciada = false;
  }

  atualizar(dt: number, posCarro: Vector3, rotCarro: Quaternion, anguloCarro: number, velocidade: number, nitro: boolean): void {
    this.posicionar(dt, posCarro, rotCarro, anguloCarro, velocidade, nitro);
    if (this.tremor > 0.01) {
      const forca = this.tremor * this.tremor * tuning.batida.tremorCamera;
      this.deslocamentoTremor.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * forca);
      this.camera.position.add(this.deslocamentoTremor);
    }
    this.tremor *= Math.exp(-tuning.batida.amortecimentoTremor * dt);
  }

  private posicionar(dt: number, posCarro: Vector3, rotCarro: Quaternion, anguloCarro: number, velocidade: number, nitro: boolean): void {
    const c = tuning.camera;
    this.camera.position.sub(this.deslocamentoTremor);
    this.deslocamentoTremor.set(0, 0, 0);
    const fracaoVelocidade = Math.min(Math.abs(velocidade) / (tuning.motor.velocidadeMaximaKmh / 3.6), 1);

    // Campo de visão maior com velocidade e nitro: o cenário "estica" nas
    // bordas da tela, o truque clássico para dar sensação de velocidade.
    const fovAlvo = c.fovBase + c.fovExtraVelocidade * fracaoVelocidade + (nitro ? c.fovExtraNitro : 0);
    this.fovAtual += (fovAlvo - this.fovAtual) * suavizar(3, dt);
    this.camera.fov = this.fovAtual;
    this.camera.updateProjectionMatrix();

    if (this.modo === 'capo' && !this.aPe) {
      const frente = new Vector3(0, 0, 1).applyQuaternion(rotCarro);
      const cima = new Vector3(0, 1, 0).applyQuaternion(rotCarro);
      this.camera.position.copy(posCarro).addScaledVector(cima, CAPO.altura).addScaledVector(frente, CAPO.frente);
      this.camera.up.copy(cima);
      this.camera.lookAt(this.camera.position.clone().add(frente));
      this.iniciada = false;
      return;
    }
    this.camera.up.set(0, 1, 0);

    // Segue só o ângulo horizontal do carro: se o carro capotar ou der um
    // salto, a câmera continua de pé em vez de girar junto.
    if (!this.iniciada) this.anguloSuave = anguloCarro;
    this.anguloSuave += menorDiferencaAngulo(this.anguloSuave, anguloCarro) * suavizar(c.suavidadeDirecao, dt);

    const mult = this.modo === 'longe' ? c.multiplicadorLonge : 1;
    const distancia = (this.aPe ? c.distanciaAPe : c.distancia + c.distanciaExtraVelocidade * fracaoVelocidade) * mult;
    const frenteSuave = new Vector3(Math.sin(this.anguloSuave), 0, Math.cos(this.anguloSuave));
    const alvo = posCarro.clone().addScaledVector(frenteSuave, -distancia);
    alvo.y += (this.aPe ? c.alturaAPe : c.altura) * mult;

    if (!this.iniciada) {
      this.camera.position.copy(alvo);
      this.iniciada = true;
    } else {
      this.camera.position.lerp(alvo, suavizar(c.suavidadePosicao, dt));
    }
    // A pé, olha na altura da cabeça; no carro, um pouco acima do teto.
    const olhar = this.aPe ? c.olharAFrenteAPe : c.olharAFrente;
    this.camera.lookAt(posCarro.clone().addScaledVector(frenteSuave, olhar).setY(posCarro.y + (this.aPe ? 1.5 : 1)));
  }
}

/**
 * Fator de suavização independente da taxa de quadros. Um simples
 * `lerp(alvo, 0.1)` por quadro deixaria a câmera mais rápida a 144 fps do que
 * a 60 fps; com a exponencial, o resultado é o mesmo em qualquer monitor.
 */
function suavizar(rapidez: number, dt: number): number {
  return 1 - Math.exp(-rapidez * dt);
}

/** Diferença entre dois ângulos pelo caminho mais curto (evita dar a volta de 360°). */
function menorDiferencaAngulo(de: number, para: number): number {
  return Math.atan2(Math.sin(para - de), Math.cos(para - de));
}
