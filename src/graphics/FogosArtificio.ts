import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, Vector3, type Scene } from 'three';
import { CAMADA_BRILHO } from './Camadas';

// =============================================================================
// FOGOS DE ARTIFÍCIO
// =============================================================================
// Cada estouro é uma nuvem de pontinhos (Points) que nascem juntos no alto e
// saem voando para todos os lados. A cada quadro:
//   posição += velocidade × dt;  velocidade.y -= gravidade × dt;  o brilho apaga.
// Mistura "aditiva" (AdditiveBlending): onde os pontos se sobrepõem, a cor
// soma e fica mais clara, como luz de verdade. Com o bloom, eles brilham.
// =============================================================================

const PONTOS_POR_ESTOURO = 180;
const GRAVIDADE = 6;
const DURACAO = 2.2;
const CORES = [0xff4d6d, 0xffd84d, 0x33e1ff, 0x7cff6b, 0xc77dff, 0xffffff];

interface Estouro {
  pontos: Points;
  velocidades: Float32Array;
  idade: number;
}

export class FogosArtificio {
  private readonly estouros: Estouro[] = [];
  /** Estouros que ainda faltam: [segundos até estourar, onde]. */
  private readonly agendados: { tempo: number; onde: Vector3 }[] = [];

  constructor(private readonly cena: Scene) {}

  /** Uma salva de fogos em volta de `centro`, durante alguns segundos. */
  disparar(centro: Vector3, quantidade = 14, duracao = 6): void {
    for (let k = 0; k < quantidade; k++) {
      const onde = centro.clone().add(new Vector3((Math.random() - 0.5) * 50, 28 + Math.random() * 22, (Math.random() - 0.5) * 50));
      this.agendados.push({ tempo: (k / quantidade) * duracao + Math.random() * 0.3, onde });
    }
  }

  atualizar(dt: number): void {
    for (let k = this.agendados.length - 1; k >= 0; k--) {
      const a = this.agendados[k];
      a.tempo -= dt;
      if (a.tempo <= 0) {
        this.estourar(a.onde);
        this.agendados.splice(k, 1);
      }
    }
    for (let k = this.estouros.length - 1; k >= 0; k--) {
      const e = this.estouros[k];
      e.idade += dt;
      const pos = e.pontos.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < PONTOS_POR_ESTOURO; i++) {
        e.velocidades[i * 3 + 1] -= GRAVIDADE * dt;
        // Arrasto do ar: os pontos freiam (sem isso a "bola" só cresceria).
        for (let eixo = 0; eixo < 3; eixo++) e.velocidades[i * 3 + eixo] *= 1 - 1.2 * dt;
        pos.setXYZ(i, pos.getX(i) + e.velocidades[i * 3] * dt, pos.getY(i) + e.velocidades[i * 3 + 1] * dt, pos.getZ(i) + e.velocidades[i * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      const material = e.pontos.material as PointsMaterial;
      material.opacity = Math.max(0, 1 - e.idade / DURACAO);
      if (e.idade >= DURACAO) {
        this.cena.remove(e.pontos);
        e.pontos.geometry.dispose();
        material.dispose();
        this.estouros.splice(k, 1);
      }
    }
  }

  private estourar(onde: Vector3): void {
    const posicoes = new Float32Array(PONTOS_POR_ESTOURO * 3);
    const velocidades = new Float32Array(PONTOS_POR_ESTOURO * 3);
    const rapidez = 10 + Math.random() * 8;
    for (let i = 0; i < PONTOS_POR_ESTOURO; i++) {
      posicoes.set([onde.x, onde.y, onde.z], i * 3);
      // Direção sorteada numa esfera: todos saem com quase a mesma rapidez,
      // e por isso o estouro forma uma "bola" redondinha.
      const d = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      d.multiplyScalar(rapidez * (0.85 + Math.random() * 0.3));
      velocidades.set([d.x, d.y, d.z], i * 3);
    }
    const geometria = new BufferGeometry();
    geometria.setAttribute('position', new BufferAttribute(posicoes, 3));
    const material = new PointsMaterial({
      color: new Color(CORES[Math.floor(Math.random() * CORES.length)]).multiplyScalar(3),
      size: 0.9,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const pontos = new Points(geometria, material);
    pontos.frustumCulled = false; // a nuvem cresce; a caixa calculada no começo ficaria pequena
    pontos.layers.enable(CAMADA_BRILHO);
    this.cena.add(pontos);
    this.estouros.push({ pontos, velocidades, idade: 0 });
  }
}
