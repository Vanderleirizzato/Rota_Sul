import {
  AnimationMixer,
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
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALIDADES, type NivelQualidade } from '../config/quality';
import { obterAnimacoes, obterModelo } from '../world/CarregadorModelos';
import { PERSONAGENS, type IdPersonagem } from '../world/assets';
import { criarRenderizador } from './Renderizador';

// =============================================================================
// VITRINE DO MENU: o personagem escolhido, girando num disco
// =============================================================================
// Uma cena 3D pequena, separada da corrida, num estúdio escuro com holofotes,
// como numa sessão de fotos: uma luz principal forte, uma de preenchimento e
// duas "de recorte" coloridas atrás, que desenham o contorno do personagem.
// O carro não se escolhe aqui: os três estão estacionados no jogo, e o
// jogador anda até o que quiser.
//
// A luz ambiente do estúdio vem de um "estúdio de mentira" (RoomEnvironment,
// que vem com o three.js): caixas claras que iluminam o boneco por todos os lados.
// =============================================================================

/** Voltas por segundo do disco giratório. */
const GIRO = 0.12;
/** Altura do disco (m): o personagem fica em cima dele. */
const ALTURA_DISCO = 0.12;
/** Tempo (s) da "descida" do personagem ao trocar. */
const TEMPO_TROCA = 0.35;

/** Um personagem pronto na vitrine: o modelo e o "tocador" da animação de parado. */
interface NaVitrine {
  objeto: Object3D;
  mixer: AnimationMixer;
}

export class Vitrine {
  private readonly renderizador: WebGLRenderer;
  private readonly cena = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 200);
  private readonly disco = new Group();
  private readonly personagens = new Map<IdPersonagem, NaVitrine>();
  private visivel: IdPersonagem | null = null;
  private tempoTroca = TEMPO_TROCA;
  /** Quanto a imagem é empurrada para a direita (0 = personagem no meio). */
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
    const base = new Mesh(new CylinderGeometry(1.1, 1.15, ALTURA_DISCO, 72), new MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.25, metalness: 0.7 }));
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

    // Mirando um pouco abaixo do peito: o personagem fica na parte de cima
    // da tela, e embaixo sobra lugar para o nome e os botões.
    this.camera.position.set(4.6, 1.6, 4.6);
    this.camera.lookAt(0, 0.55, 0);
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
  }

  /**
   * Carrega o personagem `primeiro` e o mostra. Os outros continuam
   * carregando depois que esta função termina, sem fazer o menu esperar.
   */
  async carregar(ids: readonly IdPersonagem[], primeiro: IdPersonagem): Promise<void> {
    await this.carregarUm(primeiro);
    this.mostrar(primeiro);
    const outros = ids.filter((id) => id !== primeiro).map((id) => this.carregarUm(id));
    Promise.all(outros).catch((erro: unknown) => console.error('Falha ao carregar um personagem da vitrine:', erro));
  }

  /** Troca o personagem no disco (se ele ainda está carregando, aparece quando chegar). */
  mostrar(id: IdPersonagem): void {
    if (this.visivel === id) return;
    for (const [outro, p] of this.personagens) p.objeto.visible = outro === id;
    this.visivel = id;
    this.tempoTroca = 0;
  }

  /** Personagem no meio da tela (escolha) ou à direita (menu, com as opções à esquerda). */
  aDireita(sim: boolean): void {
    this.deslocamentoAlvo = sim ? 0.3 : 0;
  }

  atualizar(dt: number): void {
    this.disco.rotation.y += dt * GIRO * Math.PI * 2;
    // Troca de personagem: ele "cai" de leve no disco (uma curva suave, sem física).
    this.tempoTroca = Math.min(this.tempoTroca + dt, TEMPO_TROCA);
    const t = this.tempoTroca / TEMPO_TROCA;
    const atual = this.visivel ? this.personagens.get(this.visivel) : undefined;
    if (atual) {
      atual.objeto.position.y = ALTURA_DISCO + (1 - t) * (1 - t) * 0.4;
      atual.mixer.update(dt);
    }

    // Desliza a imagem aos poucos (em vez de pular) quando o menu muda.
    this.deslocamento += (this.deslocamentoAlvo - this.deslocamento) * Math.min(dt * 6, 1);
    this.aplicarDeslocamento();
    this.renderizador.render(this.cena, this.camera);
  }

  private async carregarUm(id: IdPersonagem): Promise<void> {
    const [objeto, animacoes] = await Promise.all([obterModelo(id), obterAnimacoes(id)]);
    const mixer = new AnimationMixer(objeto);
    const nome = PERSONAGENS[id].animacoes.parado;
    const parado = animacoes.find((a) => a.name.split('|').pop() === nome);
    if (parado) mixer.clipAction(parado).play();
    objeto.position.y = ALTURA_DISCO;
    objeto.visible = this.visivel === id;
    this.personagens.set(id, { objeto, mixer });
    this.disco.add(objeto);
  }

  private holofote(cor: number, intensidade: number, [x, y, z]: [number, number, number], sombra: boolean): void {
    const luz = new SpotLight(cor, intensidade, 30, Math.PI / 6, 0.6, 1.5);
    luz.position.set(x, y, z);
    luz.target.position.set(0, 0.9, 0);
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
