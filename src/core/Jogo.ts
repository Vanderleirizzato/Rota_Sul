import { Quaternion, Scene, Vector3, type WebGLRenderer } from 'three';
import { MundoFisico, PASSO_FISICA } from '../physics/MundoFisico';
import { VeiculoFisico, type ComandosCarro } from '../physics/VeiculoFisico';
import { Transmissao } from '../physics/Transmissao';
import { CarroVisual } from '../graphics/CarroVisual';
import { aplicarMateriaisCarro } from '../graphics/MateriaisCarro';
import { EfeitosCarro } from '../graphics/EfeitosCarro';
import { CameraPerseguicao, NOMES_CAMERA } from '../graphics/CameraPerseguicao';
import { Ceu } from '../graphics/Ceu';
import { Iluminacao, LUZ_PADRAO, type ConfigLuz } from '../graphics/Iluminacao';
import { PosProcessamento } from '../graphics/PosProcessamento';
import { criarRenderizador } from '../graphics/Renderizador';
import { obterModelo } from '../world/CarregadorModelos';
import { MODELOS, type IdCarro, type InfoModelo } from '../world/assets';
import { criarPistaTeste } from '../world/PistaTeste';
import type { Cenario, EstadoCarro } from '../world/Cenario';
import { construirFase } from '../world/Fase';
import { FASES, FASE_INICIAL, type IdFase } from '../world/levels';
import { Hud } from '../ui/Hud';
import { PainelDev } from '../ui/PainelDev';
import { VerColisores } from '../graphics/VerColisores';
import { TelaPausa } from '../ui/TelaPausa';
import { HudCorrida } from '../ui/HudCorrida';
import { TelaFimFase } from '../ui/TelaFimFase';
import { QUALIDADES, type NivelQualidade } from '../config/quality';
import { tuning } from '../config/tuning';
import { AudioCarro } from './AudioCarro';
import { Corrida } from './Corrida';
import { lerRecorde, registrarTempo } from './Recordes';
import { LoopFixo } from './LoopFixo';
import { Entrada } from './Entrada';
import { lerEscolhas, salvarEscolhas } from './Escolhas';
import { irParaFase, irParaMenu } from './Estados';
import { colocarPlaca } from '../graphics/Placa';
import { aplicarSuperVelocidade, liberarModoDev, modoDevLiberado } from './ModoDev';
import { MensagemEasterEgg } from '../ui/MensagemEasterEgg';

/** O carro do jogador: física e visual andam juntos. */
interface Carro {
  id: IdCarro;
  fisico: VeiculoFisico;
  visual: CarroVisual;
}

/** Altura acima do asfalto ao reposicionar (m): o carro "cai" de leve e assenta. */
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
  /** Teclado e controle de videogame juntos. */
  private readonly entrada = new Entrada();
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
  private readonly verColisores = new VerColisores(this.cena, this.fisica);
  private readonly telaFim = new TelaFimFase();
  private readonly mensagemEasterEgg = new MensagemEasterEgg();
  private carro!: Carro;
  private cenario!: Cenario;
  /** Só existe nas fases com chegada (a pista de teste não tem corrida). */
  private corrida: Corrida | null = null;
  private hudCorrida: HudCorrida | null = null;
  /** Última amostra da pista onde o carro estava (acelera a busca do próximo quadro). */
  private indiceNaPista: number | undefined;
  private distanciaNaPista = 0;
  private tempoForaDaPista = 0;
  private nivelQualidade: NivelQualidade = lerEscolhas().qualidade;
  private trocandoCarro = false;
  private pausado = false;
  private ultimoTempo = performance.now();
  /** A batida mais forte do carro neste quadro (variação de velocidade em m/s). */
  private batidaNoQuadro = 0;
  /** Tempo (s) desde o último som de batida: evita metralhar sons quando o carro raspa. */
  private tempoDesdeBatida = 0;
  /** O carro como o cenário enxerga (posição, giro e velocidade), reaproveitado a cada passo. */
  private readonly estadoCarro: EstadoCarro = { posicao: new Vector3(), rotacao: new Quaternion(), velocidade: new Vector3() };
  private tempoTotal = 0;

  // Objetos reaproveitados a cada quadro (evita criar lixo para o coletor).
  private readonly posDesenho = new Vector3();
  private readonly rotDesenho = new Quaternion();

  private constructor(luz: ConfigLuz, idFase: IdFase | 'teste') {
    this.renderizador = criarRenderizador();
    this.camera = new CameraPerseguicao(window.innerWidth / window.innerHeight);
    this.iluminacao = new Iluminacao(this.cena, luz);
    this.ceu = new Ceu(this.cena, this.renderizador, this.iluminacao.direcaoSol, luz.ceu);
    this.posProcessamento = new PosProcessamento(this.renderizador, this.cena, this.camera.camera);
    this.efeitos = new EfeitosCarro(this.cena);
    this.painel = new PainelDev(
      () => this.carro.fisico.aplicarMassa(),
      (nivel) => {
        this.aplicarQualidade(nivel);
        salvarEscolhas({ qualidade: nivel });
      },
      (mostrar) => this.verColisores.ligar(mostrar),
      {
        ...Object.fromEntries(Object.entries(FASES).map(([id, f]) => [f.nome, id])),
        'Pista de teste': 'teste',
      },
      idFase,
      this.nivelQualidade,
    );
    this.aplicarQualidade(this.nivelQualidade);

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

  /**
   * Monta o jogo na fase pedida no endereço: ?fase=teste abre a pista de
   * teste de física; sem nada, abre a fase inicial.
   */
  static async criar(): Promise<Jogo> {
    const pedida = new URLSearchParams(window.location.search).get('fase');
    const idFase: IdFase | 'teste' = pedida === 'teste' ? 'teste' : pedida && pedida in FASES ? (pedida as IdFase) : FASE_INICIAL;
    // A luz precisa existir antes da cena; o resto da fase vem depois.
    const jogo = new Jogo(idFase === 'teste' ? LUZ_PADRAO : FASES[idFase].iluminacao, idFase);
    jogo.cenario = idFase === 'teste' ? criarPistaTeste(jogo.cena, jogo.fisica) : await construirFase(FASES[idFase], jogo.cena, jogo.fisica);
    jogo.cenario.aplicarQualidade(QUALIDADES[jogo.nivelQualidade]);
    const largada = jogo.cenario.largada;
    // O carro escolhido na garagem do menu.
    jogo.carro = await jogo.criarCarro(lerEscolhas().carro, largada.posicao, largada.angulo);
    if (jogo.cenario.chegada !== null) {
      jogo.corrida = new Corrida(jogo.cenario.chegada);
      jogo.hudCorrida = new HudCorrida(jogo.cenario.nome, jogo.cenario.local, lerRecorde(jogo.cenario.id));
    }
    // Compila agora os "programas" de todos os materiais da fase. Sem isso, o
    // navegador compila cada um na 1ª vez que o objeto aparece na tela, e o
    // jogo dá um engasgo (o fps despenca por um instante) no meio da corrida.
    await jogo.renderizador.compileAsync(jogo.cena, jogo.camera.camera);
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
    this.verColisores.atualizar();
    this.entrada.comecoDoQuadro();
    this.tratarTeclasDeUmToque();
    if (this.pausado) {
      // Pausado: não avança a física, só continua desenhando a cena parada.
      this.posProcessamento.desenhar();
      this.entrada.fimDoQuadro();
      return;
    }
    this.tempoTotal += dt;

    this.acompanharPista(dt);
    const comandos = this.comandosDaCorrida(this.lerComandos());
    const carro = this.carro;
    const fisico = carro.fisico;
    this.batidaNoQuadro = 0;
    const alfa = this.loop.avancar(dt, (passo) => {
      fisico.guardarEstadoAnterior();
      fisico.atualizar(passo, comandos);
      const v = fisico.corpo.linvel();
      this.estadoCarro.posicao.copy(fisico.posicaoAtual);
      this.estadoCarro.rotacao.copy(fisico.rotacaoAtual);
      this.estadoCarro.velocidade.set(v.x, v.y, v.z);
      // O cenário reage ao carro: trânsito anda, e o que ele vai atingir vira objeto solto.
      this.cenario.passoFisica(passo, this.estadoCarro);
      const antes = fisico.corpo.linvel();
      this.fisica.passo();
      fisico.guardarEstado();
      // Batida = a velocidade muda de repente num só passo. Motor e freio
      // mudam a velocidade aos pouquinhos; só uma pancada muda vários m/s de
      // uma vez. Só a parte horizontal: pousar de um salto não conta.
      const depois = fisico.corpo.linvel();
      const variacao = Math.hypot(depois.x - antes.x, depois.z - antes.z);
      this.batidaNoQuadro = Math.max(this.batidaNoQuadro, variacao);
      if (variacao > tuning.batida.limiar) fisico.absorverTranco();
    });
    this.tocarBatidas(dt);
    if (this.cenario.pegouTrofeu()) this.liberarModoDev();

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
    this.cenario.atualizar(dt, this.camera.camera, this.renderizador.domElement.height, this.posDesenho, alfa);
    this.atualizarCorrida(dt);
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
    this.entrada.fimDoQuadro();
  }

  /** Som e tremor de câmera: batidas da lataria, cones (plástico), pessoas e postes. */
  private tocarBatidas(dt: number): void {
    const b = tuning.batida;
    this.tempoDesdeBatida += dt;
    const forca = Math.min((this.batidaNoQuadro - b.limiar) / (b.batidaForte - b.limiar), 1);
    if (forca > 0 && this.tempoDesdeBatida > 0.15) {
      this.audio.batida(forca, 'metal');
      this.camera.tremer(forca);
      this.tempoDesdeBatida = 0;
    }
    const impactos = this.cenario.colherImpactos();
    if (impactos.plastico > 0) {
      this.audio.batida(impactos.plastico, 'plastico');
      // Cone não sacode o carro: só um tremidinho.
      this.camera.tremer(impactos.plastico * 0.25);
    }
    if (impactos.macio > 0) {
      this.audio.batida(impactos.macio, 'macio');
      this.camera.tremer(impactos.macio * 0.3);
    }
    if (impactos.metal > 0) {
      this.audio.batida(impactos.metal, 'metal');
      this.camera.tremer(impactos.metal * 0.6);
    }
  }

  private lerComandos(): ComandosCarro {
    const t = this.entrada;
    return {
      acelerar: t.segurando('acelerar'),
      frear: t.segurando('frear'),
      direcao: t.direcao(),
      freioMao: t.segurando('freioMao'),
      nitro: t.segurando('nitro'),
    };
  }

  private tratarTeclasDeUmToque(): void {
    const t = this.entrada;
    if (t.apertou('pausar')) this.definirPausa(!this.pausado);
    // O painel de tuning só abre depois do troféu (ou no npm run dev).
    if (t.apertou('painelDev') && modoDevLiberado()) this.painel.alternar();
    if (this.pausado) {
      if (t.apertou('menu')) irParaMenu();
      if (t.apertou('reiniciar')) {
        this.reiniciarCorrida();
        this.definirPausa(false);
      }
      return;
    }
    if (this.corrida?.estado === 'chegou') {
      // Fim de fase: Enter vai para a próxima (ou para o menu, depois da
      // última); M volta ao menu; T corre esta fase de novo (logo abaixo).
      if (t.apertou('confirmar')) {
        const proxima = this.proximaFase();
        if (proxima) irParaFase(proxima);
        else irParaMenu();
      }
      if (t.apertou('menu')) irParaMenu();
    }
    if (t.apertou('trocarCamera')) this.camera.proximoModo();
    if (t.apertou('reposicionar')) this.reposicionar();
    if (t.apertou('reiniciar')) this.reiniciarCorrida();
    if (t.apertou('carro1')) void this.trocarCarro('carro1');
    if (t.apertou('carro2')) void this.trocarCarro('carro2');
    if (t.apertou('carro3')) void this.trocarCarro('carro3');
  }

  // ---------------------------------------------------------------------------
  // Corrida e pista
  // ---------------------------------------------------------------------------

  /**
   * Onde o carro está na pista? Serve para o cronômetro (cruzou a chegada?) e
   * para devolver à estrada quem saiu dela ou caiu da ponte.
   */
  private acompanharPista(dt: number): void {
    const tracado = this.cenario.tracado;
    if (!tracado) return;
    const posicao = this.carro.fisico.posicaoAtual;
    const proj = tracado.projetar(posicao, this.indiceNaPista);
    this.indiceNaPista = proj.indice;
    this.distanciaNaPista = proj.distancia;

    // Pátio (porto): chão calçado, o carro anda livre. Em qualquer outro
    // lugar fora do acostamento, é "grama": freia e, longe demais, volta.
    const depoisDaBeira = proj.afastamento - tracado.meiaLarguraTotal;
    const livre = this.cenario.areaLivre(proj.distancia, proj.lateral, depoisDaBeira);
    this.carro.fisico.naGrama = depoisDaBeira > 0 && !livre;
    const r = tuning.reposicionamento;
    const fora = !livre && depoisDaBeira > r.distanciaForaPista;
    const nivelMar = this.cenario.nivelMar;
    const caiu =
      posicao.y < tracado.alturaSuperficie(proj.indice, 0) - r.quedaAbaixoPista ||
      // Entrou no mar: volta na hora (carro não nada).
      (nivelMar !== null && posicao.y < nivelMar + r.alturaNoMar);
    this.tempoForaDaPista = fora ? this.tempoForaDaPista + dt : 0;
    if (caiu || this.tempoForaDaPista > r.tempoForaPista) this.reposicionar();
  }

  /** Na contagem o carro fica preso; depois da chegada, ele vai parando sozinho. */
  private comandosDaCorrida(comandos: ComandosCarro): ComandosCarro {
    const estado = this.corrida?.estado;
    if (estado === 'contagem' || estado === 'chegou') {
      return { acelerar: false, frear: false, direcao: 0, freioMao: true, nitro: false };
    }
    return comandos;
  }

  private atualizarCorrida(dt: number): void {
    const corrida = this.corrida;
    if (!corrida) return;
    const evento = corrida.atualizar(dt, this.distanciaNaPista);
    if (evento?.tipo === 'numero') this.audio.bip(false);
    if (evento?.tipo === 'largou') this.audio.bip(true);
    if (evento?.tipo === 'chegou') {
      const recordeNovo = registrarTempo(this.cenario.id, evento.tempo);
      const recorde = lerRecorde(this.cenario.id);
      const proxima = this.proximaFase();
      this.telaFim.mostrar(this.cenario.nome, evento.tempo, recorde, recordeNovo, proxima ? FASES[proxima].nome : null);
      if (recorde !== null) this.hudCorrida?.mostrarRecorde(recorde);
    }
    this.hudCorrida?.atualizar(corrida.estado, corrida.tempo, corrida.restante);
  }

  /** Encostou no troféu: libera o painel (para sempre) e liga a super velocidade. */
  private liberarModoDev(): void {
    const primeiraVez = liberarModoDev();
    this.painel.trocarValores(aplicarSuperVelocidade);
    this.mensagemEasterEgg.mostrar(primeiraVez);
    this.audio.bip(true);
  }

  /** A fase seguinte na ordem da viagem (lista FASES), ou null se esta é a última. */
  private proximaFase(): IdFase | null {
    const ids = Object.keys(FASES) as IdFase[];
    const i = ids.indexOf(this.cenario.id as IdFase);
    return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
  }

  /** Volta para a largada e começa a contagem de novo. */
  private reiniciarCorrida(): void {
    const { posicao, angulo } = this.cenario.largada;
    this.carro.fisico.reposicionar(posicao.clone(), angulo);
    this.camera.reiniciar();
    this.indiceNaPista = undefined;
    this.telaFim.esconder();
    this.corrida?.reiniciar();
    this.cenario.reiniciar();
    // Corrida nova, tanque cheio: senão o nitro gasto na anterior faria falta.
    this.carro.fisico.nitro = 1;
  }

  private definirPausa(pausado: boolean): void {
    this.pausado = pausado;
    this.telaPausa.mostrar(pausado);
    if (pausado) this.audio.pausar();
    else this.audio.retomar();
  }

  private aplicarQualidade(nivel: NivelQualidade): void {
    this.nivelQualidade = nivel;
    const q = QUALIDADES[nivel];
    // O cenário só existe depois de carregado (a 1ª chamada vem do construtor).
    if (this.cenario !== undefined) this.cenario.aplicarQualidade(q);
    this.iluminacao.aplicarQualidade(q);
    this.posProcessamento.aplicarQualidade(q);
    // Além da neblina, a câmera não desenha nada: economiza a placa de vídeo.
    this.camera.camera.far = q.distanciaDesenho;
    this.camera.camera.updateProjectionMatrix();
  }

  /**
   * Põe o carro de pé e de volta à estrada.
   * Nas fases: no centro da pista, no ponto mais próximo de onde ele estava,
   * apontando para a chegada. Na pista de teste (sem traçado): de pé onde
   * está, ou na largada se caiu do mundo.
   */
  private reposicionar(): void {
    const f = this.carro.fisico;
    const tracado = this.cenario.tracado;
    if (tracado) {
      const i = tracado.projetar(f.posicaoAtual, this.indiceNaPista).indice;
      const posicao = tracado.pontos[i].clone();
      posicao.y += ALTURA_REPOSICIONAR;
      f.reposicionar(posicao, tracado.anguloEm(i));
    } else {
      const largada = this.cenario.largada;
      const caiu = f.posicaoAtual.y < 0;
      const posicao = caiu ? largada.posicao.clone() : f.posicaoAtual.clone().setY(ALTURA_REPOSICIONAR);
      f.reposicionar(posicao, caiu ? largada.angulo : f.anguloHorizontal);
    }
    this.tempoForaDaPista = 0;
    this.camera.reiniciar();
  }

  private async trocarCarro(id: IdCarro): Promise<void> {
    if (this.trocandoCarro || id === this.carro.id) return;
    this.trocandoCarro = true;
    salvarEscolhas({ carro: id });
    try {
      const antigo = this.carro;
      const posicao = antigo.fisico.posicaoAtual.clone();
      posicao.y += ALTURA_REPOSICIONAR;
      const novo = await this.criarCarro(id, posicao, antigo.fisico.anguloHorizontal);
      antigo.fisico.destruir();
      this.cena.remove(antigo.visual.objeto);
      this.carro = novo;
    } catch (erro) {
      console.error(`Não consegui trocar para o ${id}:`, erro);
    } finally {
      // "finally" roda com ou sem erro. Sem ele, um erro deixaria a trava
      // ligada para sempre e as teclas 1/2/3 parariam de funcionar.
      this.trocandoCarro = false;
    }
  }

  private async criarCarro(id: IdCarro, posicao: Vector3, angulo: number): Promise<Carro> {
    const info: InfoModelo = MODELOS[id];
    if (!info.rodas) throw new Error(`O modelo ${id} não tem rodas no manifesto.`);
    const visual = new CarroVisual(await obterModelo(id), info.rodas);
    aplicarMateriaisCarro(visual.objeto, visual.malhasDasRodas());
    colocarPlaca(visual, info.alturaPlaca ?? visual.geometria.raioRoda * 1.4);
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
