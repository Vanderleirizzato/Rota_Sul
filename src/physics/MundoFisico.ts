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

  /** Cria um cilindro fixo em pé (troncos de árvore, pedras). `centro` é o meio do cilindro. */
  criarCilindroFixo(centro: { x: number; y: number; z: number }, raio: number, meiaAltura: number): RAPIER.Collider {
    const corpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(centro.x, centro.y, centro.z));
    return this.mundo.createCollider(RAPIER.ColliderDesc.cylinder(meiaAltura, raio).setFriction(0.8), corpo);
  }

  /**
   * Caixa que a física move de verdade (cai, rola, é arremessada). Leve, ela
   * voa longe quando o carro bate; o carro de 1200 kg quase nem sente.
   */
  criarCaixaDinamica(
    centro: { x: number; y: number; z: number },
    meias: { x: number; y: number; z: number },
    rotacao: { x: number; y: number; z: number; w: number },
    massa: number,
  ): RAPIER.RigidBody {
    const corpo = this.mundo.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(centro.x, centro.y, centro.z).setRotation(rotacao),
    );
    this.mundo.createCollider(
      RAPIER.ColliderDesc.cuboid(meias.x, meias.y, meias.z).setMass(massa).setFriction(0.6).setRestitution(0.3),
      corpo,
    );
    return corpo;
  }

  /**
   * Corpo "cinemático": o CÓDIGO decide onde ele está (a física não o empurra),
   * mas os outros corpos batem nele. Serve para pessoas andando: o carro não
   * as atravessa, e elas não saem voando quando encostam no carro.
   */
  criarCapsulaCinematica(raio: number, meiaAltura: number): RAPIER.RigidBody {
    const corpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.mundo.createCollider(RAPIER.ColliderDesc.capsule(meiaAltura, raio), corpo);
    return corpo;
  }

  /**
   * Cria um colisor fixo com o formato exato de uma malha de triângulos
   * (asfalto, terreno). Caixas não servem para superfícies curvas e inclinadas
   * como uma estrada de serra; a malha acompanha cada subida e curva.
   */
  criarMalhaFixa(vertices: Float32Array, indices: Uint32Array, atrito = 0.8): RAPIER.Collider {
    const corpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // FIX_INTERNAL_EDGES: sem isso, a roda que desliza de um triângulo para o
    // vizinho às vezes "tropeça" na aresta entre eles (uma lombada fantasma,
    // invisível, que pode capotar o carro). Com a opção, o Rapier sabe que
    // a aresta é interna e a superfície continua lisa.
    const forma = RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
    return this.mundo.createCollider(forma.setFriction(atrito), corpo);
  }

  /**
   * Colisor fixo no formato do "embrulho justo" (casco convexo) de um monte de
   * pontos já no mundo. Ver FormaColisor.ts. Devolve null se os pontos não
   * formam um volume (todos alinhados, por exemplo).
   */
  criarCascoFixo(pontos: Float32Array): RAPIER.Collider | null {
    const forma = RAPIER.ColliderDesc.convexHull(pontos);
    if (!forma) return null;
    const corpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    return this.mundo.createCollider(forma.setFriction(0.8), corpo);
  }
}

export async function iniciarRapier(): Promise<void> {
  await RAPIER.init();
}
