import { Quaternion, Scene, Vector3, type WebGLRenderer } from 'three';
import { MundoFisico, PASSO_FISICA } from '../physics/MundoFisico';
import { VeiculoFisico, type ComandosCarro } from '../physics/VeiculoFisico';
import { Transmissao } from '../physics/Transmissao';
import { CarroVisual } from '../graphics/CarroVisual';
import { aplicarMateriaisCarro } from '../graphics/MateriaisCarro';
import { EfeitosCarro } from '../graphics/EfeitosCarro';
import { CameraPerseguicao, NOMES_CAMERA } from '../graphics/CameraPerseguicao';
import { Ceu } from '../graphics/Ceu';
import { DIRECAO_SOL_TESTE, Iluminacao } from '../graphics/Iluminacao';
import { PosProcessamento } from '../graphics/PosProcessamento';
import { criarRenderizador } from '../graphics/Renderizador';
import { obterModelo } from '../world/CarregadorModelos';
import { MODELOS, type IdCarro, type InfoModelo } from '../world/assets';
import { criarPistaTeste, LARGADA_TESTE } from '../world/PistaTeste';
import { Hud } from '../ui/Hud';
import { PainelDev } from '../ui/PainelDev';
import { TelaPausa } from '../ui/TelaPausa';
import { QUALIDADES, QUALIDADE_PADRAO, type NivelQualidade } from '../config/quality';
import { tuning } from '../config/tuning';
import { AudioCarro } from './AudioCarro';
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
 * (Na Etapa 5, os estados Menu/Seleção/Jogando/Pausa/Fim viram um gerenciador próprio.)
 */
export class Jogo {
  private readonly renderizador: WebGLRenderer;
  private readonly cena = new Scene();
  private readonly fisica = new MundoFisico();
  private readonly loop = new LoopFixo(PASSO_FISICA);
  private readonly teclado = new Teclado();
  private readonly camera: CameraPerseguicao;
  private readonly iluminacao: Iluminacao;
  private readonly ceu: Ceu;
  private readonly posProcessamento: PosProcessamento;
  private readonly efeitos: EfeitosCarro;
  private readonly transmissao = new Transmissao();
  private readonly audio = new AudioCarro();
  private readonly hud = new Hud();
  private readonly telaPausa = new TelaPausa();
  private readonly painel: PainelDev;
  private carro!: Carro;
  private trocandoCarro = false;
  private pausado = false;
  private ultimoTempo = performance.now();
  private tempoTotal = 0;

  // Objetos reaproveitados a cada quadro (evita criar lixo para o coletor).
  private readonly posDesenho = new Vector3();
  private readonly rotDesenho = new Quaternion();

  private constructor() {
    this.renderizador = criarRenderizador();
    this.camera = new CameraPerseguicao(window.innerWidth / window.innerHeight);
    this.iluminacao = new Iluminacao(this.cena, DIRECAO_SOL_TESTE);
    this.ceu = new Ceu(this.cena, this.renderizador, DIRECAO_SOL_TESTE);
    this.posProcessamento = new PosProcessamento(this.renderizador, this.cena, this.camera.camera);
    this.efeitos = new EfeitosCarro(this.cena);
    this.painel = new PainelDev(
      () => this.carro.fisico.aplicarMassa(),
      (nivel) => this.aplicarQualidade(nivel),
    );
    criarPistaTeste(this.cena, this.fisica);
    this.aplicarQualidade(QUALIDADE_PADRAO);

    window.addEventListener('resize', () => this.aoRedimensionar());
    // Navegadores só deixam tocar som depois de um gesto do jogador.
    const ligarSom = (): void => this.audio.iniciar();
    window.addEventListener('keydown', ligarSom, { once: true });
    window.addEventListener('pointerdown', ligarSom, { once: true });
    // Trocou de aba ou minimizou: pausa sozinho.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.definirPausa(true);
    });
  }

  static async criar(): Promise<Jogo> {
    const jogo = new Jogo();
    jogo.carro = await jogo.criarCarro('carro1', LARGADA_TESTE.posicao, LARGADA_TESTE.angulo);
    return jogo;
  }

  iniciar(): void {
    const quadro = (agora: number): void => {
      const dt = Math.min((agora - this.ultimoTempo) / 1000, 0.25);
      this.ultimoTempo = agora;
      this.atualizar(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  // ---------------------------------------------------------------------------

  private atualizar(dt: number): void {
    this.painel.contarQuadro();
    this.tratarTeclasDeUmToque();
    if (this.pausado) {
      // Pausado: não avança a física, só continua desenhando a cena parada.
      this.posProcessamento.desenhar();
      this.teclado.fimDoQuadro();
      return;
    }
    this.tempoTotal += dt;

    const comandos = this.lerComandos();
    const carro = this.carro;
    const fisico = carro.fisico;
    const alfa = this.loop.avancar(dt, (passo) => {
      fisico.guardarEstadoAnterior();
      fisico.atualizar(passo, comandos);
      this.fisica.passo();
      fisico.guardarEstado();
    });

    if (fisico.precisaReposicionar) this.reposicionar();

    // Interpolação: desenha o carro entre o passo anterior e o atual.
    this.posDesenho.lerpVectors(fisico.posicaoAnterior, fisico.posicaoAtual, alfa);
    this.rotDesenho.slerpQuaternions(fisico.rotacaoAnterior, fisico.rotacaoAtual, alfa);
    carro.visual.atualizar(this.posDesenho, this.rotDesenho, [0, 1, 2, 3].map((i) => fisico.estadoRoda(i)));

    // Câmbio, som e efeitos: só leem o estado do carro, não mexem na física.
    const rodasLivres = !fisico.noChao || comandos.freioMao;
    const troca = this.transmissao.atualizar(dt, fisico.velocidade, comandos.acelerar, rodasLivres);
    if (troca) this.audio.trocaDeMarcha(troca === 'subiu');
    this.audio.atualizar({
      rpm: this.transmissao.rpm,
      rpmMaximo: tuning.transmissao.rpmMaximo,
      acelerando: comandos.acelerar,
      derrapagem: fisico.intensidadeDerrapagem,
      nitro: fisico.nitroLigado,
    });
    this.efeitos.atualizar(dt, fisico, carro.visual.escapamentos, this.posDesenho, this.rotDesenho);

    this.camera.atualizar(dt, this.posDesenho, this.rotDesenho, fisico.anguloHorizontal, fisico.velocidade, fisico.nitroLigado);
    this.efeitos.ajustarEscala(this.camera.camera, this.renderizador.domElement.height);
    this.iluminacao.seguir(this.posDesenho);
    this.ceu.atualizar(this.camera.camera.position, this.tempoTotal);
    this.hud.atualizar({
      velocidadeMs: fisico.velocidade,
      rpm: this.transmissao.rpm,
      rpmMaximo: tuning.transmissao.rpmMaximo,
      marcha: this.transmissao.marcha,
      nitro: fisico.nitro,
      nitroLigado: fisico.nitroLigado,
      derrapando: fisico.derrapando,
      camera: NOMES_CAMERA[this.camera.modo],
    });

    this.posProcessamento.desenhar();
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
    if (t.apertou('pausar')) this.definirPausa(!this.pausado);
    if (t.apertou('painelDev')) this.painel.alternar();
    if (this.pausado) return;
    if (t.apertou('trocarCamera')) this.camera.proximoModo();
    if (t.apertou('reposicionar')) this.reposicionar();
    if (t.apertou('carro1')) void this.trocarCarro('carro1');
    if (t.apertou('carro2')) void this.trocarCarro('carro2');
  }

  private definirPausa(pausado: boolean): void {
    this.pausado = pausado;
    this.telaPausa.mostrar(pausado);
    if (pausado) this.audio.pausar();
    else this.audio.retomar();
  }

  private aplicarQualidade(nivel: NivelQualidade): void {
    const q = QUALIDADES[nivel];
    this.iluminacao.aplicarQualidade(q);
    this.posProcessamento.aplicarQualidade(q);
    // Além da neblina, a câmera não desenha nada: economiza a placa de vídeo.
    this.camera.camera.far = q.distanciaDesenho;
    this.camera.camera.updateProjectionMatrix();
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
    try {
      const antigo = this.carro;
      const novo = await this.criarCarro(id, antigo.fisico.posicaoAtual.clone().setY(ALTURA_REPOSICIONAR), antigo.fisico.anguloHorizontal);
      antigo.fisico.destruir();
      this.cena.remove(antigo.visual.objeto);
      this.carro = novo;
    } catch (erro) {
      console.error(`Não consegui trocar para o ${id}:`, erro);
    } finally {
      // "finally" roda com ou sem erro. Sem ele, um erro deixaria a trava
      // ligada para sempre e as teclas 1/2 parariam de funcionar.
      this.trocandoCarro = false;
    }
  }

  private async criarCarro(id: IdCarro, posicao: Vector3, angulo: number): Promise<Carro> {
    const info: InfoModelo = MODELOS[id];
    if (!info.rodas) throw new Error(`O modelo ${id} não tem rodas no manifesto.`);
    const visual = new CarroVisual(await obterModelo(id), info.rodas);
    aplicarMateriaisCarro(visual.objeto, visual.malhasDasRodas());
    this.cena.add(visual.objeto);
    const fisico = new VeiculoFisico(this.fisica.mundo, visual.geometria, posicao, angulo);
    return { id, fisico, visual };
  }

  private aoRedimensionar(): void {
    this.camera.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.camera.updateProjectionMatrix();
    this.posProcessamento.redimensionar();
  }
}
