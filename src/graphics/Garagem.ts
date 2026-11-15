import {
  AmbientLight,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SpotLight,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALIDADES, type NivelQualidade } from '../config/quality';
import { obterModelo } from '../world/CarregadorModelos';
import { MODELOS, type IdCarro } from '../world/assets';
import { CarroVisual } from './CarroVisual';
import { aplicarMateriaisCarro } from './MateriaisCarro';
import { colocarPlaca } from './Placa';
import { criarRenderizador } from './Renderizador';

// =============================================================================
// GARAGEM DO MENU
// =============================================================================
// Uma cena 3D pequena, separada da corrida: o carro girando num disco, num
// estúdio escuro com três holofotes. É a mesma ideia de foto de carro em
// revista: uma luz principal forte, uma de preenchimento e duas "de recorte"
// coloridas atrás, que desenham o contorno da lataria.
//
// Os reflexos do verniz (clearcoat) precisam de algo para refletir. Na
// corrida é o céu; aqui é um "estúdio de mentira" (RoomEnvironment, que vem
// com o three.js): caixas claras que viram faixas de luz deslizando na lataria.
// =============================================================================

/** Voltas por segundo do disco giratório. */
const GIRO = 0.12;
/** Altura do disco (m): o carro fica em cima dele. */
const ALTURA_DISCO = 0.12;
/** Tempo (s) da "descida" do carro ao trocar. */
const TEMPO_TROCA = 0.35;

export class Garagem {
  private readonly renderizador: WebGLRenderer;
  private readonly cena = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 200);
  private readonly disco = new Group();
  private readonly carros = new Map<IdCarro, CarroVisual>();
  private visivel: IdCarro | null = null;
  private tempoTroca = TEMPO_TROCA;
  /** Quanto a imagem é empurrada para a direita (0 = carro no meio). */
  private deslocamento = 0;
  private deslocamentoAlvo = 0;

  constructor(qualidade: NivelQualidade) {
    this.renderizador = criarRenderizador();
    // O estúdio é bem mais escuro que um dia de sol: exposição mais alta.
    this.renderizador.toneMappingExposure = 0.75;
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, QUALIDADES[qualidade].pixelRatioMaximo, 2));

    const cena = this.cena;
    cena.background = new Color(0x07090e);
    cena.fog = new Fog(0x07090e, 12, 30);
    const pmrem = new PMREMGenerator(this.renderizador);
    cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    cena.environmentIntensity = 0.3;
    pmrem.dispose();

    // Chão escuro e liso (pouco áspero): reflete um pouco as luzes.
    const chao = new Mesh(new CircleGeometry(30, 64), new MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.55, metalness: 0.3 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    cena.add(chao);
    const base = new Mesh(new CylinderGeometry(3.3, 3.4, ALTURA_DISCO, 72), new MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.25, metalness: 0.7 }));
    base.position.y = ALTURA_DISCO / 2;
    base.receiveShadow = true;
    base.castShadow = true;
    this.disco.add(base);
    cena.add(this.disco);

    cena.add(new AmbientLight(0xffffff, 0.15));
    this.holofote(0xffffff, 110, [4, 8, 5], true); // principal
    this.holofote(0xffffff, 35, [-6, 6, 3], false); // preenchimento
    this.holofote(0x33e1ff, 70, [-5, 3, -6], false); // recorte azul (cor do HUD)
    this.holofote(0xffaa33, 60, [6, 3, -5], false); // recorte laranja

    // Mirando um pouco abaixo do carro: ele fica na parte de cima da tela,
    // e embaixo sobra lugar para o nome e os botões.
    this.camera.position.set(7.2, 2.4, 7.2);
    this.camera.lookAt(0, 0.1, 0);
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
  }

  /**
   * Carrega o carro `primeiro` e o mostra. Os outros continuam carregando
   * depois que esta função termina, sem fazer o menu esperar por eles.
   */
  async carregar(ids: readonly IdCarro[], primeiro: IdCarro): Promise<void> {
    await this.carregarUm(primeiro);
    this.mostrar(primeiro);
    const outros = ids.filter((id) => id !== primeiro).map((id) => this.carregarUm(id));
    Promise.all(outros).catch((erro: unknown) => console.error('Falha ao carregar um carro da garagem:', erro));
  }

  /** Troca o carro no disco (se ele ainda está carregando, aparece quando chegar). */
  mostrar(id: IdCarro): void {
    if (this.visivel === id) return;
    for (const [outro, carro] of this.carros) carro.objeto.visible = outro === id;
    this.visivel = id;
    this.tempoTroca = 0;
  }

  /** Carro no meio da tela (garagem) ou à direita (menu, com as opções à esquerda). */
  carroADireita(sim: boolean): void {
    this.deslocamentoAlvo = sim ? 0.3 : 0;
  }

  atualizar(dt: number): void {
    this.disco.rotation.y += dt * GIRO * Math.PI * 2;
    // Troca de carro: ele "cai" de leve no disco (uma curva suave, sem física).
    this.tempoTroca = Math.min(this.tempoTroca + dt, TEMPO_TROCA);
    const t = this.tempoTroca / TEMPO_TROCA;
    const carro = this.visivel ? this.carros.get(this.visivel) : undefined;
    if (carro) carro.objeto.position.y = ALTURA_DISCO + (1 - t) * (1 - t) * 0.6;

    // Desliza a imagem aos poucos (em vez de pular) quando o menu muda.
    this.deslocamento += (this.deslocamentoAlvo - this.deslocamento) * Math.min(dt * 6, 1);
    this.aplicarDeslocamento();
    this.renderizador.render(this.cena, this.camera);
  }

  private async carregarUm(id: IdCarro): Promise<void> {
    const info = MODELOS[id];
    const visual = new CarroVisual(await obterModelo(id), info.rodas);
    aplicarMateriaisCarro(visual.objeto, visual.malhasDasRodas());
    colocarPlaca(visual, info.alturaPlaca);
    visual.objeto.position.y = ALTURA_DISCO;
    visual.objeto.visible = this.visivel === id;
    this.carros.set(id, visual);
    this.disco.add(visual.objeto);
  }

  private holofote(cor: number, intensidade: number, [x, y, z]: [number, number, number], sombra: boolean): void {
    const luz = new SpotLight(cor, intensidade, 30, Math.PI / 6, 0.6, 1.5);
    luz.position.set(x, y, z);
    luz.target.position.set(0, 0.5, 0);
    if (sombra) {
      luz.castShadow = true;
      luz.shadow.mapSize.set(1024, 1024);
      luz.shadow.bias = -0.0005;
    }
    this.cena.add(luz, luz.target);
  }

  private redimensionar(): void {
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** "Desliza" a imagem para o lado sem mexer na câmera (setViewOffset). */
  private aplicarDeslocamento(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (Math.abs(this.deslocamento) < 0.001) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, -w * this.deslocamento, 0, w, h);
  }
}
