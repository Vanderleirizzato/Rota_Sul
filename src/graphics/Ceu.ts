import { PMREMGenerator, Scene, Vector3, type WebGLRenderer } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Céu procedural: em vez de uma foto de céu (pesada e fixa), um shader calcula
// a cor de cada ponto pela física do espalhamento da luz do sol no ar. Mudando
// a posição do sol, muda tudo: azul ao meio-dia, alaranjado no pôr do sol.
// Cada fase escolhe o seu céu nos dados de iluminação (ConfigLuz).

/** Aparência do céu. Valores do modelo de Preetham (o do shader). */
export interface ConfigCeu {
  /** Névoa/poluição no ar. Mais alto: céu esbranquiçado. */
  turbidez: number;
  /** Espalhamento azul. Mais alto: céu mais azul e escuro no alto. */
  rayleigh: number;
  /** Cobertura de nuvens (0 a 1). */
  nuvens: number;
}

/** Quanto o céu ilumina os materiais (reflexos e luz difusa do ambiente). */
const INTENSIDADE_AMBIENTE = 0.35;

export class Ceu {
  private readonly ceu = new Sky();

  constructor(cena: Scene, renderizador: WebGLRenderer, direcaoSol: Vector3, config: ConfigCeu) {
    const u = this.ceu.material.uniforms;
    u.turbidity.value = config.turbidez;
    u.rayleigh.value = config.rayleigh;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    u.cloudCoverage.value = config.nuvens;
    u.sunPosition.value.copy(direcaoSol);
    // O shader desenha o céu sempre "no fundo", então o tamanho da caixa só
    // precisa ser maior que o plano "near" da câmera.
    this.ceu.scale.setScalar(100);
    this.ceu.frustumCulled = false;

    // Mapa de ambiente: uma "foto" do céu usada nos reflexos dos materiais PBR.
    // É ele que faz a lataria do carro refletir o azul do céu. Geramos sem o
    // disco do sol, que viraria um ponto branco estourado nos reflexos.
    u.showSunDisc.value = 0;
    const cenaCeu = new Scene();
    cenaCeu.add(this.ceu);
    const pmrem = new PMREMGenerator(renderizador);
    cena.environment = pmrem.fromScene(cenaCeu).texture;
    // O céu do shader é muito mais claro que as luzes da cena; sem reduzir,
    // todo material ficaria iluminado demais pelo reflexo do céu.
    cena.environmentIntensity = INTENSIDADE_AMBIENTE;
    pmrem.dispose();
    u.showSunDisc.value = 1;

    cena.add(this.ceu);
  }

  /** O céu acompanha a câmera (ela nunca chega na "parede" do céu). */
  atualizar(posicaoCamera: Vector3, tempo: number): void {
    this.ceu.position.copy(posicaoCamera);
    this.ceu.material.uniforms.time.value = tempo; // nuvens andando
  }
}
