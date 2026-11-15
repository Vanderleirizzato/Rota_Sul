import RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';

/** Duração de um passo de física (s). Ver LoopFixo.ts para o porquê. */
export const PASSO_FISICA = 1 / 60;

/**
 * Envolve o mundo do Rapier.
 *
 * O Rapier é escrito em Rust e compilado para WebAssembly: por isso precisa
 * de `iniciarRapier()` (que carrega o WASM) antes de qualquer outra coisa.
 */
export class MundoFisico {
  readonly mundo: RAPIER.World;

  constructor() {
    this.mundo = new RAPIER.World({ x: 0, y: -tuning.mundo.gravidade, z: 0 });
    this.mundo.timestep = PASSO_FISICA;
  }

  /** Avança a simulação um passo. */
  passo(): void {
    // Relê a gravidade a cada passo para o painel F2 funcionar ao vivo.
    this.mundo.gravity = { x: 0, y: -tuning.mundo.gravidade, z: 0 };
    this.mundo.step();
  }

  /** Cria um corpo fixo (chão, rampa, parede) com um colisor de caixa. */
  criarCaixaFixa(
    centro: { x: number; y: number; z: number },
    meiaLargura: number,
    meiaAltura: number,
    meioComprimento: number,
    rotacao: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 },
  ): RAPIER.Collider {
    const corpo = this.mundo.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(centro.x, centro.y, centro.z).setRotation(rotacao),
    );
    return this.mundo.createCollider(
      RAPIER.ColliderDesc.cuboid(meiaLargura, meiaAltura, meioComprimento).setFriction(0.8),
      corpo,
    );
  }
}

export async function iniciarRapier(): Promise<void> {
  await RAPIER.init();
}
