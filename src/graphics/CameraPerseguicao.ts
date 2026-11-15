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
  private anguloSuave = 0;
  private fovAtual = tuning.camera.fovBase;
  private iniciada = false;

  constructor(proporcao: number) {
    this.camera = new PerspectiveCamera(tuning.camera.fovBase, proporcao, 0.1, 2000);
  }

  proximoModo(): void {
    this.modo = MODOS[(MODOS.indexOf(this.modo) + 1) % MODOS.length];
  }

  /** Teleporta a câmera para trás do carro (após reposicionar, por exemplo). */
  reiniciar(): void {
    this.iniciada = false;
  }

  atualizar(dt: number, posCarro: Vector3, rotCarro: Quaternion, anguloCarro: number, velocidade: number, nitro: boolean): void {
    const c = tuning.camera;
    const fracaoVelocidade = Math.min(Math.abs(velocidade) / (tuning.motor.velocidadeMaximaKmh / 3.6), 1);

    // Campo de visão maior com velocidade e nitro: o cenário "estica" nas
    // bordas da tela, o truque clássico para dar sensação de velocidade.
    const fovAlvo = c.fovBase + c.fovExtraVelocidade * fracaoVelocidade + (nitro ? c.fovExtraNitro : 0);
    this.fovAtual += (fovAlvo - this.fovAtual) * suavizar(3, dt);
    this.camera.fov = this.fovAtual;
    this.camera.updateProjectionMatrix();

    if (this.modo === 'capo') {
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
    const distancia = (c.distancia + c.distanciaExtraVelocidade * fracaoVelocidade) * mult;
    const frenteSuave = new Vector3(Math.sin(this.anguloSuave), 0, Math.cos(this.anguloSuave));
    const alvo = posCarro.clone().addScaledVector(frenteSuave, -distancia);
    alvo.y += c.altura * mult;

    if (!this.iniciada) {
      this.camera.position.copy(alvo);
      this.iniciada = true;
    } else {
      this.camera.position.lerp(alvo, suavizar(c.suavidadePosicao, dt));
    }
    this.camera.lookAt(posCarro.clone().addScaledVector(frenteSuave, c.olharAFrente).setY(posCarro.y + 1));
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
