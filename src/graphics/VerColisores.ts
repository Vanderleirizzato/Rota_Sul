import RAPIER from '@dimforge/rapier3d-compat';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';

// =============================================================================
// VER COLISORES (Modo Dev): desenha em linhas o que a física "enxerga".
// =============================================================================
// O desenho (malhas do three.js) e a física (colisores do Rapier) são dois
// mundos separados que só combinam se o código fizer combinar. Quando o carro
// bate "no nada", ligue isto no F2 e veja qual colisor está sobrando.
//
// O chão e a pista (malhas de triângulos) ficam de fora: são milhares de
// triângulos que cobririam a tela de linhas e não ajudam a achar obstáculos.
// =============================================================================

/** Redesenha a cada tantos quadros (a lista de linhas é grande; não precisa ser todo quadro). */
const QUADROS_ENTRE_ATUALIZACOES = 10;

export class VerColisores {
  private readonly linhas: LineSegments;
  private ligado = false;
  private contador = 0;

  constructor(
    cena: Scene,
    private readonly fisica: MundoFisico,
  ) {
    this.linhas = new LineSegments(
      new BufferGeometry(),
      // depthTest desligado: aparece até o colisor escondido dentro de uma pedra.
      new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8 }),
    );
    this.linhas.visible = false;
    this.linhas.frustumCulled = false;
    this.linhas.renderOrder = 999;
    cena.add(this.linhas);
  }

  ligar(mostrar: boolean): void {
    this.ligado = mostrar;
    this.linhas.visible = mostrar;
    this.contador = 0;
  }

  atualizar(): void {
    if (!this.ligado || this.contador++ % QUADROS_ENTRE_ATUALIZACOES !== 0) return;
    const { vertices, colors } = this.fisica.mundo.debugRender(
      undefined,
      (c) => c.shapeType() !== RAPIER.ShapeType.TriMesh,
    );
    const g = this.linhas.geometry;
    g.setAttribute('position', new BufferAttribute(vertices, 3));
    g.setAttribute('color', new BufferAttribute(colors, 4));
  }
}
