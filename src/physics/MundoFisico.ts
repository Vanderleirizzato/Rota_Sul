import RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';

/** Duração de um passo de física (s). Ver LoopFixo.ts para o porquê. */
export const PASSO_FISICA = 1 / 60;

// Grupos de colisão: quem pode bater em quem. No Rapier, cada colisor diz a
// que grupo PERTENCE (16 bits de cima) e com quais grupos ACEITA bater (16 bits
// de baixo). Aqui os grupos servem para os raios da suspensão (abaixo).
const SOLTOS = 0b0100;
const TRANSITO = 0b1000;
const TODOS = 0xffff;
const grupos = (pertence: number, bateEm: number): number => (pertence << 16) | bateEm;
export const GRUPO_SOLTOS = grupos(SOLTOS, TODOS);
export const GRUPO_TRANSITO = grupos(TRANSITO, TODOS);
/**
 * Os raios da suspensão (ver VeiculoFisico) ignoram cones e o trânsito: senão
 * a roda "pisaria" no cone ou no teto do carro da frente como se fosse chão,
 * levantaria um lado do carro e ele capotaria. A LATARIA continua batendo
 * neles normalmente.
 */
export const GRUPO_RAIOS_RODAS = grupos(TODOS, TODOS & ~(SOLTOS | TRANSITO));

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
   * Caixa cinemática para os veículos do trânsito. Cinemática porque eles
   * precisam seguir a faixa à risca: o código diz onde estão a cada passo e o
   * carro do jogador, ao bater, é empurrado (como num muro que anda).
   * A caixa fica apoiada na origem do corpo (as rodas), não centrada nela.
   * Pouco atrito: numa batida de traseira, o capô do jogador escorrega na
   * caixa em vez de "agarrar" e subir nela (o que empinaria o carro).
   */
  criarVeiculoCinematico(meias: { x: number; y: number; z: number }): RAPIER.RigidBody {
    const corpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.mundo.createCollider(RAPIER.ColliderDesc.cuboid(meias.x, meias.y, meias.z).setTranslation(0, meias.y, 0).setFriction(0.1).setCollisionGroups(GRUPO_TRANSITO), corpo);
    return corpo;
  }

  /**
   * Objeto solto (cone, barreira de plástico, poste derrubado): dinâmico, voa na batida.
   * CCD ("detecção contínua"): sem ela, um cone arremessado a 150 km/h anda
   * mais que a própria espessura num passo e pode atravessar o chão.
   * `forma`: o cone usa a forma de cone mesmo (rola como um cone de verdade).
   */
  criarSolto(
    forma:
      | { tipo: 'cone' | 'cilindro'; raio: number; meiaAltura: number }
      | { tipo: 'caixa'; meias: { x: number; y: number; z: number } },
    centro: { x: number; y: number; z: number },
    rotacao: { x: number; y: number; z: number; w: number },
    massa: number,
  ): RAPIER.RigidBody {
    const corpo = this.mundo.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(centro.x, centro.y, centro.z).setRotation(rotacao).setCcdEnabled(true).setLinearDamping(0.2).setAngularDamping(0.4),
    );
    const desc =
      forma.tipo === 'caixa'
        ? RAPIER.ColliderDesc.cuboid(forma.meias.x, forma.meias.y, forma.meias.z)
        : forma.tipo === 'cone'
          ? RAPIER.ColliderDesc.cone(forma.meiaAltura, forma.raio)
          : RAPIER.ColliderDesc.cylinder(forma.meiaAltura, forma.raio);
    this.mundo.createCollider(desc.setMass(massa).setFriction(0.7).setRestitution(0.25).setCollisionGroups(GRUPO_SOLTOS), corpo);
    // Começa "dormindo": parado não custa nada até alguém encostar.
    corpo.sleep();
    return corpo;
  }

  /**
   * Transforma um veículo do trânsito (cinemático) num corpo DINÂMICO: a
   * partir daí, quem manda nele é a física. Assim uma batida divide a força
   * de verdade (um táxi voa, um ônibus mal se mexe) e dá para empurrar um
   * carro parado. `velocidade`: a que ele já tinha, para não "parar no ar".
   */
  soltarVeiculo(corpo: RAPIER.RigidBody, massa: number, atrito: number, arrasto: number, velocidade: { x: number; y: number; z: number }): void {
    corpo.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    corpo.enableCcd(true);
    const colisor = corpo.collider(0);
    colisor.setMass(massa);
    colisor.setFriction(atrito);
    corpo.setLinvel(velocidade, true);
    corpo.setLinearDamping(arrasto);
    corpo.setAngularDamping(0.5);
  }

  /** Tira um colisor do mundo (um poste derrubado deixa de ser obstáculo). */
  removerColisor(colisor: RAPIER.Collider): void {
    this.mundo.removeCollider(colisor, true);
  }

  /** Tira um corpo (e seus colisores) do mundo. */
  remover(corpo: RAPIER.RigidBody): void {
    this.mundo.removeRigidBody(corpo);
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
