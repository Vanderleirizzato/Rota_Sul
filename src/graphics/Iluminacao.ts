import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three';

// Iluminação básica da pista de teste. O céu procedural e a qualidade das
// sombras vêm na Etapa 1B; por enquanto é um fundo azul e um sol simples.

/** Direção de onde vem o sol (não precisa ser unitária). */
const DIRECAO_SOL = new Vector3(-0.5, 1, -0.35).normalize();
/** Lado da área coberta pela sombra (m). Menor = sombra mais nítida. */
const AREA_SOMBRA = 50;

export class Iluminacao {
  private readonly sol: DirectionalLight;

  constructor(cena: Scene) {
    cena.background = new Color(0x9cc8ee);
    cena.fog = new Fog(0x9cc8ee, 200, 900);

    // Luz do "céu" (azulada de cima) e do "chão" (amarronzada de baixo).
    cena.add(new HemisphereLight(0xcfe6ff, 0x6b5a45, 1.2));

    this.sol = new DirectionalLight(0xfff2dd, 2.6);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    const cam = this.sol.shadow.camera;
    cam.left = -AREA_SOMBRA / 2;
    cam.right = AREA_SOMBRA / 2;
    cam.top = AREA_SOMBRA / 2;
    cam.bottom = -AREA_SOMBRA / 2;
    cam.near = 1;
    cam.far = 200;
    this.sol.shadow.bias = -0.0005;
    this.sol.shadow.normalBias = 0.02;
    cena.add(this.sol, this.sol.target);
  }

  /**
   * A sombra cobre só um quadrado em volta do carro e anda com ele. Cobrir a
   * pista inteira com a mesma resolução deixaria cada pixel de sombra do
   * tamanho de um carro.
   */
  seguir(alvo: Vector3): void {
    this.sol.target.position.copy(alvo);
    this.sol.position.copy(alvo).addScaledVector(DIRECAO_SOL, 100);
  }
}
