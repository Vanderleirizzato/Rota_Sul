import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from 'three';

// Sistema de partículas genérico (fumaça, fogo, faíscas...).
//
// Cada partícula é um ponto que a placa de vídeo desenha como um quadradinho
// virado para a câmera; o shader recorta um círculo de borda suave. Todas as
// partículas de um sistema são UMA malha só, com um tamanho fixo de memória
// (`maximo`): quando acaba o espaço, a mais velha é reaproveitada. Assim não
// criamos nem destruímos objetos durante o jogo, o que causaria engasgos.

export interface ConfigParticulas {
  /** Quantas partículas podem existir ao mesmo tempo. */
  maximo: number;
  /** Duração de cada partícula (s). */
  vida: number;
  /** Diâmetro ao nascer e ao morrer (m). */
  tamanhoInicial: number;
  tamanhoFinal: number;
  /** Cor ao nascer e ao morrer. */
  corInicial: Color;
  corFinal: Color;
  /** Opacidade ao nascer (ela cai até zero no fim da vida). */
  opacidade: number;
  /** Soma a cor com o fundo (brilha, bom para fogo) em vez de cobrir (fumaça). */
  aditivo: boolean;
  /** Aceleração vertical (m/s²): positiva sobe (fumaça quente), negativa cai. */
  empuxo: number;
  /** Freio do ar: quanto da velocidade se perde por segundo (0 a 1). */
  arrasto: number;
}

export class SistemaParticulas {
  readonly objeto: Points;
  private readonly posicoes: Float32Array;
  private readonly velocidades: Float32Array;
  private readonly idades: Float32Array;
  private readonly atribPosicao: BufferAttribute;
  private readonly atribIdade: BufferAttribute;
  private readonly material: ShaderMaterial;
  private proxima = 0;

  constructor(private readonly config: ConfigParticulas) {
    const n = config.maximo;
    this.posicoes = new Float32Array(n * 3);
    this.velocidades = new Float32Array(n * 3);
    // Idade em fração da vida (0 = nasceu, 1 = morreu). Começam todas mortas.
    this.idades = new Float32Array(n).fill(1);

    const geo = new BufferGeometry();
    this.atribPosicao = new BufferAttribute(this.posicoes, 3);
    this.atribIdade = new BufferAttribute(this.idades, 1);
    geo.setAttribute('position', this.atribPosicao);
    geo.setAttribute('idade', this.atribIdade);

    this.material = new ShaderMaterial({
      uniforms: {
        uEscala: { value: 500 },
        uTamanhos: { value: [config.tamanhoInicial, config.tamanhoFinal] },
        uCorInicial: { value: config.corInicial },
        uCorFinal: { value: config.corFinal },
        uOpacidade: { value: config.opacidade },
      },
      vertexShader: /* glsl */ `
        attribute float idade;
        uniform float uEscala;
        uniform float uTamanhos[2];
        varying float vIdade;
        void main() {
          vIdade = idade;
          // Partícula morta: jogamos para FORA da tela (coordenadas além de 1
          // são cortadas antes de virar pixel). Só "tamanho zero" não basta:
          // algumas placas de vídeo ainda desenham 1 pixel com cor inválida
          // (NaN), e o bloom espalha esse pixel numa neblina que não some.
          if (idade >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tamanho = mix(uTamanhos[0], uTamanhos[1], idade);
          // Perspectiva: o tamanho na tela cai com a distância. O max() evita
          // dividir por zero quando a partícula encosta na câmera, e o clamp
          // limita o tamanho a algo que a placa de vídeo aceita.
          gl_PointSize = clamp(tamanho * uEscala / max(-mv.z, 0.1), 0.0, 512.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCorInicial;
        uniform vec3 uCorFinal;
        uniform float uOpacidade;
        varying float vIdade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float borda = smoothstep(0.5, 0.15, d); // círculo de borda macia
          // Some mais rápido no fim da vida (curva ao quadrado): sem isso, as
          // partículas velhas e quase transparentes se acumulam numa névoa.
          float restante = clamp(1.0 - vIdade, 0.0, 1.0);
          float alfa = borda * uOpacidade * restante * restante;
          // Pixel invisível (ou com conta inválida: "alfa > x" é falso para NaN)
          // não é escrito na imagem. Protege o bloom de lixo numérico.
          if (!(alfa > 0.002)) discard;
          gl_FragColor = vec4(mix(uCorInicial, uCorFinal, vIdade), alfa);
        }`,
      transparent: true,
      depthWrite: false, // partículas não "tampam" umas às outras
      blending: config.aditivo ? AdditiveBlending : NormalBlending,
    });

    this.objeto = new Points(geo, this.material);
    // As partículas se espalham pelo mundo; o cálculo automático de "está na
    // tela?" usaria uma caixa velha e as faria sumir. Desligamos.
    this.objeto.frustumCulled = false;
  }

  emitir(posicao: Vector3, velocidade: Vector3): void {
    const i = this.proxima;
    this.proxima = (this.proxima + 1) % this.config.maximo;
    this.posicoes.set([posicao.x, posicao.y, posicao.z], i * 3);
    this.velocidades.set([velocidade.x, velocidade.y, velocidade.z], i * 3);
    this.idades[i] = 0;
  }

  atualizar(dt: number): void {
    const { vida, empuxo, arrasto } = this.config;
    const freio = Math.max(0, 1 - arrasto * dt);
    for (let i = 0; i < this.config.maximo; i++) {
      if (this.idades[i] >= 1) continue;
      this.idades[i] = Math.min(1, this.idades[i] + dt / vida);
      const j = i * 3;
      this.velocidades[j] *= freio;
      this.velocidades[j + 1] = this.velocidades[j + 1] * freio + empuxo * dt;
      this.velocidades[j + 2] *= freio;
      this.posicoes[j] += this.velocidades[j] * dt;
      this.posicoes[j + 1] += this.velocidades[j + 1] * dt;
      this.posicoes[j + 2] += this.velocidades[j + 2] * dt;
    }
    this.atribPosicao.needsUpdate = true;
    this.atribIdade.needsUpdate = true;
  }

  /** Converte metros em pixels de acordo com a câmera e a altura da tela. */
  ajustarEscala(camera: PerspectiveCamera, alturaEmPixels: number): void {
    this.material.uniforms.uEscala.value = alturaEmPixels / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
}
