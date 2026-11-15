import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three';
import type { ConfigQualidade } from '../config/quality';

// Luz do sol (com sombra) + luz do céu. A direção do sol é a mesma usada pelo
// céu procedural, para a sombra cair do lado certo do brilho do céu.

/** Direção de onde vem o sol na pista de teste: manhã, alto e à esquerda. */
export const DIRECAO_SOL_TESTE = new Vector3(-0.5, 0.8, -0.35).normalize();
/** Cor da neblina: perto da cor do horizonte, para o chão "sumir" no céu. */
const COR_NEBLINA = 0xbcd2e4;

export class Iluminacao {
  private readonly sol: DirectionalLight;
  private readonly neblina: Fog;

  constructor(cena: Scene, private readonly direcaoSol: Vector3) {
    this.neblina = new Fog(COR_NEBLINA, 100, 700);
    cena.fog = this.neblina;
    cena.background = new Color(COR_NEBLINA); // só aparece se o céu falhar

    // Luz do "céu" (azulada de cima) e do "chão" (amarronzada de baixo).
    cena.add(new HemisphereLight(0xcfe6ff, 0x6b5a45, 1.0));

    this.sol = new DirectionalLight(0xfff0dc, 5.0);
    this.sol.castShadow = true;
    this.sol.shadow.camera.near = 1;
    this.sol.shadow.camera.far = 250;
    this.sol.shadow.bias = -0.0005;
    this.sol.shadow.normalBias = 0.02;
    cena.add(this.sol, this.sol.target);
  }

  aplicarQualidade(q: ConfigQualidade): void {
    this.sol.castShadow = q.sombras;
    const cam = this.sol.shadow.camera;
    cam.left = -q.areaSombra / 2;
    cam.bottom = -q.areaSombra / 2;
    cam.right = q.areaSombra / 2;
    cam.top = q.areaSombra / 2;
    cam.updateProjectionMatrix();
    if (this.sol.shadow.mapSize.x !== q.tamanhoSombra) {
      this.sol.shadow.mapSize.set(q.tamanhoSombra, q.tamanhoSombra);
      // Joga fora o mapa antigo; o three cria um novo no tamanho certo.
      this.sol.shadow.map?.dispose();
      this.sol.shadow.map = null;
    }
    // A neblina termina onde paramos de desenhar: nada "aparece do nada".
    this.neblina.far = q.distanciaDesenho;
    this.neblina.near = q.distanciaDesenho * 0.15;
  }

  /**
   * A sombra cobre só um quadrado em volta do carro e anda com ele. Cobrir a
   * pista inteira com a mesma resolução deixaria cada pixel de sombra do
   * tamanho de um carro.
   */
  seguir(alvo: Vector3): void {
    this.sol.target.position.copy(alvo);
    this.sol.position.copy(alvo).addScaledVector(this.direcaoSol, 100);
  }
}
