import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three';
import type { ConfigQualidade } from '../config/quality';
import type { ConfigCeu } from './Ceu';

// Luz do sol (com sombra) + luz do céu. A direção do sol é a mesma usada pelo
// céu procedural, para a sombra cair do lado certo do brilho do céu.

/**
 * Iluminação de uma fase. Fica nos dados da fase (manhã em Foz, pôr do sol em
 * Navegantes...). Cores em hexadecimal, como no CSS: 0xffffff = branco.
 */
export interface ConfigLuz {
  /** De onde vem o sol [x, y, z]. Y pequeno = sol baixo, sombras compridas. */
  direcaoSol: [number, number, number];
  corSol: number;
  /** Força do sol. Mais alto: luz mais dura e sombras mais marcadas. */
  intensidadeSol: number;
  /** Luz que vem do céu (de cima) e a refletida pelo chão (de baixo). */
  corCeu: number;
  corChao: number;
  intensidadeCeu: number;
  /** Cor da neblina: perto da cor do horizonte, para o chão "sumir" no céu. */
  corNeblina: number;
  /** Onde a neblina começa, como fração da distância de desenho (0 a 1). */
  inicioNeblina: number;
  ceu: ConfigCeu;
}

/** Luz da pista de teste: manhã clara, sol alto. */
export const LUZ_PADRAO: ConfigLuz = {
  direcaoSol: [-0.5, 0.8, -0.35],
  corSol: 0xfff0dc,
  intensidadeSol: 5.0,
  corCeu: 0xcfe6ff,
  corChao: 0x6b5a45,
  intensidadeCeu: 1.0,
  corNeblina: 0xbcd2e4,
  inicioNeblina: 0.15,
  ceu: { turbidez: 4, rayleigh: 1.4, nuvens: 0.35 },
};

export class Iluminacao {
  readonly direcaoSol: Vector3;
  private readonly sol: DirectionalLight;
  private readonly neblina: Fog;

  constructor(cena: Scene, private readonly luz: ConfigLuz) {
    this.direcaoSol = new Vector3(...luz.direcaoSol).normalize();
    this.neblina = new Fog(luz.corNeblina, 100, 700);
    cena.fog = this.neblina;
    cena.background = new Color(luz.corNeblina); // só aparece se o céu falhar

    cena.add(new HemisphereLight(luz.corCeu, luz.corChao, luz.intensidadeCeu));

    this.sol = new DirectionalLight(luz.corSol, luz.intensidadeSol);
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
    this.neblina.near = q.distanciaDesenho * this.luz.inicioNeblina;
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
