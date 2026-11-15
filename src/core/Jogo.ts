import { Quaternion, Scene, Vector3, type WebGLRenderer } from 'three';
import { MundoFisico, PASSO_FISICA } from '../physics/MundoFisico';
import { VeiculoFisico, type ComandosCarro } from '../physics/VeiculoFisico';
import { CarroVisual } from '../graphics/CarroVisual';
import { CameraPerseguicao, NOMES_CAMERA } from '../graphics/CameraPerseguicao';
import { Iluminacao } from '../graphics/Iluminacao';
import { criarRenderizador } from '../graphics/Renderizador';
import { obterModelo } from '../world/CarregadorModelos';
import { MODELOS, type IdCarro, type InfoModelo } from '../world/assets';
import { criarPistaTeste, LARGADA_TESTE } from '../world/PistaTeste';
import { HudSimples } from '../ui/HudSimples';
import { PainelDev } from '../ui/PainelDev';
import { LoopFixo } from './LoopFixo';
import { Teclado } from './Teclado';

/** O carro do jogador: física e visual andam juntos. */
interface Carro {
  id: IdCarro;
  fisico: VeiculoFisico;
  visual: CarroVisual;
}

/** Altura acima do chão ao reposicionar (m): o carro "cai" de leve e assenta. */
const ALTURA_REPOSICIONAR = 1;

/**
 * Junta todas as peças e roda o laço principal.
 * (Na Etapa 5, os estados Menu/Jogando/Pausa entram aqui.)
 */
export class Jogo {
  private readonly renderizador: WebGLRenderer;
  private readonly cena = new Scene();
  private readonly fisica = new MundoFisico();
  private readonly loop = new LoopFixo(PASSO_FISICA);
  private readonly teclado = new Teclado();
  private readonly camera: CameraPerseguicao;
  private readonly iluminacao: Iluminacao;
  private readonly hud = new HudSimples();
  private readonly painel: PainelDev;
  private carro!: Carro;
  private trocandoCarro = false;
  private ultimoTempo = performance.now();

  // Objetos reaproveitados a cada quadro (evita criar lixo para o coletor).
  private readonly posDesenho = new Vector3();
  private readonly rotDesenho = new Quaternion();

  private constructor() {
    this.renderizador = criarRenderizador();
    this.camera = new CameraPerseguicao(window.innerWidth / window.innerHeight);
    this.iluminacao = new Iluminacao(this.cena);
    this.painel = new PainelDev(() => this.carro.fisico.aplicarMassa());
    criarPistaTeste(this.cena, this.fisica);
    window.addEventListener('resize', () => this.aoRedimensionar());
  }

  static async criar(): Promise<Jogo> {
    const jogo = new Jogo();
    jogo.carro = await jogo.criarCarro('carro1', LARGADA_TESTE.posicao, LARGADA_TESTE.angulo);
    return jogo;
  }

  iniciar(): void {
    const quadro = (agora: number): void => {
      const dt = (agora - this.ultimoTempo) / 1000;
      this.ultimoTempo = agora;
      this.atualizar(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  // ---------------------------------------------------------------------------

  private atualizar(dt: number): void {
    this.tratarTeclasDeUmToque();

    const comandos = this.lerComandos();
    const carro = this.carro;
    const alfa = this.loop.avancar(dt, (passo) => {
      carro.fisico.guardarEstadoAnterior();
      carro.fisico.atualizar(passo, comandos);
      this.fisica.passo();
      carro.fisico.guardarEstado();
    });

    if (carro.fisico.precisaReposicionar) this.reposicionar();

    // Interpolação: desenha o carro entre o passo anterior e o atual.
    this.posDesenho.lerpVectors(carro.fisico.posicaoAnterior, carro.fisico.posicaoAtual, alfa);
    this.rotDesenho.slerpQuaternions(carro.fisico.rotacaoAnterior, carro.fisico.rotacaoAtual, alfa);
    carro.visual.atualizar(this.posDesenho, this.rotDesenho, [0, 1, 2, 3].map((i) => carro.fisico.estadoRoda(i)));

    this.camera.atualizar(dt, this.posDesenho, this.rotDesenho, carro.fisico.anguloHorizontal, carro.fisico.velocidade, carro.fisico.nitroLigado);
    this.iluminacao.seguir(this.posDesenho);
    this.hud.atualizar(carro.fisico.velocidade, carro.fisico.nitro, carro.fisico.nitroLigado, carro.fisico.derrapando, NOMES_CAMERA[this.camera.modo]);

    this.renderizador.render(this.cena, this.camera.camera);
    this.teclado.fimDoQuadro();
  }

  private lerComandos(): ComandosCarro {
    const t = this.teclado;
    return {
      acelerar: t.segurando('acelerar'),
      frear: t.segurando('frear'),
      direcao: (t.segurando('esquerda') ? 1 : 0) - (t.segurando('direita') ? 1 : 0),
      freioMao: t.segurando('freioMao'),
      nitro: t.segurando('nitro'),
    };
  }

  private tratarTeclasDeUmToque(): void {
    const t = this.teclado;
    if (t.apertou('painelDev')) this.painel.alternar();
    if (t.apertou('trocarCamera')) this.camera.proximoModo();
    if (t.apertou('reposicionar')) this.reposicionar();
    if (t.apertou('carro1')) void this.trocarCarro('carro1');
    if (t.apertou('carro2')) void this.trocarCarro('carro2');
  }

  /**
   * Na pista de teste, "reposicionar" põe o carro de pé onde ele está. Se ele
   * caiu do mundo, volta para a largada. (Nas fases, a Etapa 2 vai usar o
   * ponto mais próximo do traçado.)
   */
  private reposicionar(): void {
    const f = this.carro.fisico;
    const caiu = f.posicaoAtual.y < 0;
    const posicao = caiu ? LARGADA_TESTE.posicao.clone() : f.posicaoAtual.clone().setY(ALTURA_REPOSICIONAR);
    f.reposicionar(posicao, caiu ? LARGADA_TESTE.angulo : f.anguloHorizontal);
    this.camera.reiniciar();
  }

  private async trocarCarro(id: IdCarro): Promise<void> {
    if (this.trocandoCarro || id === this.carro.id) return;
    this.trocandoCarro = true;
    const antigo = this.carro;
    const novo = await this.criarCarro(id, antigo.fisico.posicaoAtual.clone().setY(ALTURA_REPOSICIONAR), antigo.fisico.anguloHorizontal);
    antigo.fisico.destruir();
    this.cena.remove(antigo.visual.objeto);
    this.carro = novo;
    this.trocandoCarro = false;
  }

  private async criarCarro(id: IdCarro, posicao: Vector3, angulo: number): Promise<Carro> {
    const info: InfoModelo = MODELOS[id];
    if (!info.rodas) throw new Error(`O modelo ${id} não tem rodas no manifesto.`);
    const visual = new CarroVisual(await obterModelo(id), info.rodas);
    this.cena.add(visual.objeto);
    const fisico = new VeiculoFisico(this.fisica.mundo, visual.geometria, posicao, angulo);
    return { id, fisico, visual };
  }

  private aoRedimensionar(): void {
    this.camera.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.camera.updateProjectionMatrix();
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
  }
}
