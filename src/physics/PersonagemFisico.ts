import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { tuning } from '../config/tuning';

// =============================================================================
// FÍSICA DO PERSONAGEM (a pé)
// =============================================================================
// Por que NÃO um corpo dinâmico, como o carro? Um corpo dinâmico em forma de
// cápsula tomba, escorrega em rampa, quica ao pousar e sai rolando com
// qualquer esbarrão. Dá para "segurar" ele com truques, mas fica sempre meio
// sabonete. Jogos usam um CONTROLADOR DE PERSONAGEM: o corpo é "cinemático"
// (a física não o empurra), e a cada passo nós dizemos "quero andar tanto
// para lá". O controlador do Rapier (KinematicCharacterController) testa o
// caminho e devolve até onde dá para ir de verdade: desliza encostado na
// parede, sobe degraus e rampas suaves e para em rampas íngremes.
//
// A gravidade e o pulo ficam por nossa conta: guardamos a velocidade vertical
// e somamos ao movimento pedido.
// =============================================================================

/** Meia altura da parte reta da cápsula (m). Cápsula inteira: 2 × (0,55 + 0,3) = 1,7 m. */
const MEIA_ALTURA = 0.55;
/** Raio da cápsula (m): a "largura" do personagem. */
const RAIO = 0.3;
/** Do centro da cápsula até a sola do pé (m). */
export const CENTRO_ATE_PE = MEIA_ALTURA + RAIO;
/**
 * Folga (m) que o controlador mantém entre a cápsula e o resto do mundo.
 * Sem ela, erros de arredondamento deixariam a cápsula "entrar" um fio no
 * chão e ela travaria. Pequena demais: trava; grande demais: flutua.
 */
const FOLGA = 0.02;
/** Velocidade vertical máxima para baixo (m/s): evita atravessar o chão numa queda longa. */
const QUEDA_MAXIMA = 30;
/** Massa (kg) usada para empurrar cones e objetos soltos. */
const MASSA = 75;

/** O que o jogador está pedindo para o personagem neste passo. */
export interface ComandosAPe {
  /** -1 (para trás) a +1 (para frente). */
  frente: number;
  /** -1 (direita) a +1 (esquerda), como a direção do carro. */
  giro: number;
  correr: boolean;
  /** Apertou o pulo neste passo. */
  pular: boolean;
}

export class PersonagemFisico {
  private readonly corpo: RAPIER.RigidBody;
  private readonly colisor: RAPIER.Collider;
  private readonly controlador: RAPIER.KinematicCharacterController;
  /** Para onde ele olha, em radianos (0 = +Z, como o carro). */
  angulo = 0;
  anguloAnterior = 0;
  /** Velocidade vertical (m/s): negativa caindo, positiva no pulo. */
  private velocidadeVertical = 0;
  noChao = false;
  /** Velocidade horizontal real (m/s), já descontado o que a parede barrou. */
  velocidadeHorizontal = 0;
  /** Velocidade (m/s) em x, y e z, para o cenário (o trânsito freia para ele). */
  readonly velocidade = new Vector3();

  // Centro da cápsula no passo anterior e no atual (o desenho interpola).
  readonly posicaoAnterior = new Vector3();
  readonly posicaoAtual = new Vector3();

  private readonly desejado = new Vector3();

  constructor(private readonly mundo: RAPIER.World) {
    this.corpo = mundo.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.colisor = mundo.createCollider(RAPIER.ColliderDesc.capsule(MEIA_ALTURA, RAIO), this.corpo);
    this.controlador = mundo.createCharacterController(FOLGA);
    const a = tuning.aPe;
    // Degraus: sobe meio-fio e escada; "largura mínima" evita subir num poste fino.
    this.controlador.enableAutostep(a.degrauMaximo, 0.2, true);
    // Desce escada e ladeira "grudado" no chão, em vez de dar pulinhos.
    this.controlador.enableSnapToGround(0.3);
    this.controlador.setSlideEnabled(true);
    this.controlador.setApplyImpulsesToDynamicBodies(true);
    this.controlador.setCharacterMass(MASSA);
    this.ativar(false);
  }

  /** Liga ou desliga o personagem (dentro do carro ele não existe para a física). */
  ativar(ligado: boolean): void {
    this.colisor.setEnabled(ligado);
    this.corpo.setEnabled(ligado);
  }

  /** Teleporta: `pe` é onde fica a sola do pé. */
  reposicionar(pe: Vector3, angulo: number): void {
    this.posicaoAtual.copy(pe).setY(pe.y + CENTRO_ATE_PE);
    this.posicaoAnterior.copy(this.posicaoAtual);
    this.corpo.setTranslation(this.posicaoAtual, true);
    this.angulo = this.anguloAnterior = angulo;
    this.velocidadeVertical = 0;
    this.velocidade.set(0, 0, 0);
    this.velocidadeHorizontal = 0;
  }

  guardarEstadoAnterior(): void {
    this.posicaoAnterior.copy(this.posicaoAtual);
    this.anguloAnterior = this.angulo;
  }

  /** Um passo de física: gira, anda, pula e cai. Chamar ANTES do mundo.step(). */
  atualizar(dt: number, c: ComandosAPe): void {
    const a = tuning.aPe;
    // Os dois limites de rampa leem o tuning a cada passo: o painel F2 muda ao vivo.
    const rampa = (a.rampaMaxima * Math.PI) / 180;
    this.controlador.setMaxSlopeClimbAngle(rampa);
    this.controlador.setMinSlopeSlideAngle(rampa);

    // Gira como um tanque (A/D), anda para onde está olhando (W/S). Sem mouse,
    // é o jeito mais fácil de controlar com teclado e com o analógico.
    this.angulo += c.giro * a.giro * dt;
    const rapidez = c.frente > 0 ? (c.correr ? a.velocidadeCorrer : a.velocidadeAndar) * c.frente : a.velocidadeRe * c.frente;

    if (this.noChao && c.pular) this.velocidadeVertical = a.forcaPulo;
    else if (this.noChao && this.velocidadeVertical < 0) this.velocidadeVertical = 0;
    this.velocidadeVertical = Math.max(this.velocidadeVertical - tuning.mundo.gravidade * dt, -QUEDA_MAXIMA);

    this.desejado.set(Math.sin(this.angulo) * rapidez * dt, this.velocidadeVertical * dt, Math.cos(this.angulo) * rapidez * dt);
    // Sensores (gatilhos invisíveis) não são parede: o personagem atravessa.
    this.controlador.computeColliderMovement(this.colisor, this.desejado, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const movimento = this.controlador.computedMovement();
    this.noChao = this.controlador.computedGrounded();
    // Bateu a cabeça no teto (ou pousou): o que o controlador barrou na vertical some.
    if (Math.abs(movimento.y) < Math.abs(this.desejado.y) * 0.5 && this.velocidadeVertical > 0) this.velocidadeVertical = 0;

    const t = this.corpo.translation();
    this.corpo.setNextKinematicTranslation({ x: t.x + movimento.x, y: t.y + movimento.y, z: t.z + movimento.z });
    this.velocidade.set(movimento.x / dt, movimento.y / dt, movimento.z / dt);
    this.velocidadeHorizontal = Math.hypot(this.velocidade.x, this.velocidade.z);
  }

  /** Chamar DEPOIS do mundo.step(): lê onde a cápsula foi parar. */
  guardarEstado(): void {
    const t = this.corpo.translation();
    this.posicaoAtual.set(t.x, t.y, t.z);
  }

  destruir(): void {
    this.mundo.removeCharacterController(this.controlador);
    this.mundo.removeRigidBody(this.corpo);
  }
}
