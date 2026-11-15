import {
  Color,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector2,
  type Camera,
  type Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { ConfigQualidade } from '../config/quality';
import { CAMADA_BRILHO, CAMADA_EFEITOS, CAMADA_NORMAL } from './Camadas';

// =============================================================================
// PÓS-PROCESSAMENTO: efeitos aplicados na imagem pronta, como um filtro.
// =============================================================================
// Bloom SELETIVO: só brilha o que está na CAMADA_BRILHO (chamas, faróis...).
//
// Por que não o bloom comum, que faz brilhar tudo o que é muito claro? Porque o
// céu perto do sol é claríssimo (como o de verdade): ao virar o carro para o
// lado do sol, a tela inteira ganhava um véu branco.
//
// Como funciona:
//  1. compositorBrilho desenha, numa imagem escondida, a cena toda em PRETO e
//     por cima só os objetos brilhantes. O preto serve para o carro "tampar" o
//     brilho do que está atrás dele.
//  2. O bloom borra essa imagem: nasce o brilho em volta das chamas e faróis.
//  3. compositor desenha a cena normal, SOMA o brilho e converte as cores para
//     a tela (OutputPass). Por fim, o SMAA suaviza as bordas serrilhadas.
// =============================================================================

/** Força do brilho. Mais alto: chamas e faróis mais "estourados". */
const BLOOM_FORCA = 0.6;
/** Raio do brilho em volta do objeto. Mais alto: brilho mais espalhado. */
const BLOOM_RAIO = 0.4;

export class PosProcessamento {
  private readonly compositor: EffectComposer;
  private readonly compositorBrilho: EffectComposer;
  private readonly soma: ShaderPass;
  private readonly smaa: SMAAPass;
  private bloomLigado = true;

  constructor(private readonly renderizador: WebGLRenderer, cena: Scene, camera: Camera) {
    // A câmera principal enxerga todas as camadas.
    camera.layers.enable(CAMADA_BRILHO);
    camera.layers.enable(CAMADA_EFEITOS);

    this.compositorBrilho = new EffectComposer(renderizador);
    this.compositorBrilho.renderToScreen = false;
    this.compositorBrilho.addPass(new PassoSoBrilho(cena, camera));
    // Limiar 0: na imagem do brilho só existem coisas que devem brilhar.
    this.compositorBrilho.addPass(new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), BLOOM_FORCA, BLOOM_RAIO, 0));

    this.compositor = new EffectComposer(renderizador);
    this.compositor.addPass(new RenderPass(cena, camera));
    this.soma = new ShaderPass(materialSoma(this.compositorBrilho.renderTarget2), 'imagemBase');
    this.compositor.addPass(this.soma);
    this.compositor.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.compositor.addPass(this.smaa);
  }

  aplicarQualidade(q: ConfigQualidade): void {
    this.bloomLigado = q.bloom;
    this.soma.enabled = q.bloom;
    this.smaa.enabled = q.smaa;
    // Em tela comum (devicePixelRatio 1) o limite de pixel ratio não muda nada;
    // é a escala de resolução que faz o "Baixo" ficar leve de verdade.
    const ratio = Math.min(window.devicePixelRatio, q.pixelRatioMaximo) * q.escalaResolucao;
    this.renderizador.setPixelRatio(ratio);
    this.compositor.setPixelRatio(ratio);
    this.compositorBrilho.setPixelRatio(ratio);
    this.redimensionar();
  }

  redimensionar(): void {
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
    this.compositor.setSize(window.innerWidth, window.innerHeight);
    this.compositorBrilho.setSize(window.innerWidth, window.innerHeight);
  }

  desenhar(): void {
    // Sem bloom (qualidade Baixa), nem desenhamos a imagem do brilho: economia.
    if (this.bloomLigado) this.compositorBrilho.render();
    this.compositor.render();
  }
}

/**
 * Desenha a imagem do brilho: tudo preto, e só os objetos brilhantes coloridos.
 * (Um "Pass" é uma etapa do EffectComposer; esta é feita sob medida.)
 */
class PassoSoBrilho extends Pass {
  private readonly preto = new MeshBasicMaterial({ color: 0x000000, fog: false });
  private readonly corFundoSalva = new Color();

  constructor(private readonly cena: Scene, private readonly camera: Camera) {
    super();
    this.needsSwap = false; // desenha direto na imagem de leitura, como o RenderPass
  }

  override render(renderizador: WebGLRenderer, _escrita: WebGLRenderTarget, leitura: WebGLRenderTarget): void {
    const { cena, camera } = this;
    // Guarda o estado para devolver tudo como estava no fim.
    const fundo = cena.background;
    const camadas = camera.layers.mask;
    const autoClear = renderizador.autoClear;
    const sombras = renderizador.shadowMap.autoUpdate;
    renderizador.getClearColor(this.corFundoSalva);
    const alfaFundo = renderizador.getClearAlpha();

    cena.background = null;
    // As sombras são calculadas no desenho principal; recalcular aqui custaria
    // caro e não mudaria nada (tudo vira preto ou brilho).
    renderizador.shadowMap.autoUpdate = false;
    renderizador.setRenderTarget(leitura);
    renderizador.setClearColor(0x000000, 1);
    renderizador.clear();
    renderizador.autoClear = false;

    // 1) Tudo o que é sólido, em preto (só para tampar o brilho atrás dele).
    camera.layers.set(CAMADA_NORMAL);
    cena.overrideMaterial = this.preto;
    renderizador.render(cena, camera);
    // 2) Só os objetos brilhantes, com as cores de verdade.
    cena.overrideMaterial = null;
    camera.layers.set(CAMADA_BRILHO);
    renderizador.render(cena, camera);

    cena.background = fundo;
    camera.layers.mask = camadas;
    renderizador.autoClear = autoClear;
    renderizador.shadowMap.autoUpdate = sombras;
    renderizador.setClearColor(this.corFundoSalva, alfaFundo);
  }
}

/** Soma a imagem do brilho (já borrada pelo bloom) à imagem normal da cena. */
function materialSoma(brilho: WebGLRenderTarget): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      imagemBase: { value: null },
      imagemBrilho: { value: brilho.texture },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D imagemBase;
      uniform sampler2D imagemBrilho;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(imagemBase, vUv) + vec4(texture2D(imagemBrilho, vUv).rgb, 0.0);
      }`,
  });
}
