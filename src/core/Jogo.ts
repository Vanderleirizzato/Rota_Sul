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
import { HudCorrida, type Convite, type InfoMarcador } from '../ui/HudCorrida';
import { COR_VIAGEM, MarcadorMissao } from '../graphics/MarcadorMissao';
import { TelaFimFase, type SituacaoViagem } from '../ui/TelaFimFase';
import { DESCRICAO_PECA } from '../world/Pecas';
import {
  aplicarBonusDeTodasAsPecas,
  aplicarBonusPeca,
  faseEstaLiberada,
  liberarFase,
  pecasDaFase,
  proximaFase,
} from './Progresso';
import { formatarTempo } from './Corrida';
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
import { Personagem } from './Personagem';
import type { ComandosAPe } from '../physics/PersonagemFisico';

/** O carro do jogador: física e visual andam juntos. */
interface Carro {
  id: IdCarro;
  fisico: VeiculoFisico;
  visual: CarroVisual;
}

/** Altura acima do asfalto ao reposicionar (m): o carro "cai" de leve e assenta. */
const ALTURA_REPOSICIONAR = 1;
/** O marcador "seguir viagem" fica este tanto (m) depois da linha de chegada. */
const DEPOIS_DA_CHEGADA = 30;
/** Comandos do carro enquanto o jogador está a pé: parado, com o freio de mão puxado. */
const CARRO_ESTACIONADO: ComandosCarro = { acelerar: false, frear: false, direcao: 0, freioMao: true, nitro: false };
const EIXO_Y = new Vector3(0, 1, 0);

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
  /** Quem desce do carro com a tecla E (Etapa 9). */
  private personagem!: Personagem;
  /** Pulo pedido e ainda não feito: espera o próximo passo de física (ver atualizar). */
  private puloPendente = false;
  private cenario!: Cenario;
  /** Só existe nas fases com chegada (a pista de teste não tem corrida). */
  private corrida: Corrida | null = null;
  private hudCorrida: HudCorrida | null = null;
  /** A coluna de luz onde a corrida começa (só no passeio). */
  private marcador: MarcadorMissao | null = null;
  private posicaoMarcador = new Vector3();
  /** Onde está o marcador em relação ao carro (recalculado a cada quadro). */
  private readonly infoMarcador: InfoMarcador = { distancia: Infinity, direcao: 0, dentro: false, rapido: false };
  /** O marcador "seguir viagem", depois da chegada: só existe com a próxima fase liberada. */
  private marcadorViagem: MarcadorMissao | null = null;
  private readonly posicaoViagem = new Vector3();
  private readonly infoViagem: InfoMarcador = { distancia: Infinity, direcao: 0, dentro: false, rapido: false };
  /** Melhor tempo desta fase (para o convite do marcador). */
  private recorde: number | null = null;
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
  /** Giro do personagem como quatérnio (o cenário e a câmera pedem nesse formato). */
  private readonly rotPersonagem = new Quaternion();

  private constructor(
    luz: ConfigLuz,
    private readonly idFase: IdFase | 'teste',
  ) {
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
   * `aoCompilar`: avisado quando os downloads acabam e começa a preparação dos gráficos.
   */
  static async criar(aoCompilar?: () => void): Promise<Jogo> {
    const pedida = new URLSearchParams(window.location.search).get('fase');
    let idFase: IdFase | 'teste' = pedida === 'teste' ? 'teste' : pedida && pedida in FASES ? (pedida as IdFase) : FASE_INICIAL;
    // Fase trancada não abre pelo endereço (?fase=fase2): volta para o começo
    // da viagem. No `npm run dev` abre qualquer uma, para testar.
    if (idFase !== 'teste' && !import.meta.env.DEV && !faseEstaLiberada(idFase)) idFase = FASE_INICIAL;
    // Os bônus das peças de tuning já coletadas (em qualquer fase) valem desde a largada.
    aplicarBonusDeTodasAsPecas();
    // A luz precisa existir antes da cena; o resto da fase vem depois.
    const jogo = new Jogo(idFase === 'teste' ? LUZ_PADRAO : FASES[idFase].iluminacao, idFase);
    jogo.cenario = idFase === 'teste' ? criarPistaTeste(jogo.cena, jogo.fisica) : await construirFase(FASES[idFase], jogo.cena, jogo.fisica);
    jogo.cenario.aplicarQualidade(QUALIDADES[jogo.nivelQualidade]);
    const largada = jogo.cenario.largada;
    // O carro escolhido na garagem do menu.
    jogo.carro = await jogo.criarCarro(lerEscolhas().carro, largada.posicao, largada.angulo);
    // Começa dentro do carro (invisível e fora da física até descer).
    jogo.personagem = await Personagem.criar(jogo.cena, jogo.fisica.mundo);
    if (jogo.cenario.chegada !== null) {
      // O jogo começa passeando; a corrida começa no marcador, na largada.
      jogo.corrida = new Corrida(jogo.cenario.chegada);
      jogo.hudCorrida = new HudCorrida(jogo.cenario.nome, jogo.cenario.local, lerRecorde(jogo.cenario.id));
      // A largada guarda onde o carro "nasce" (um pouco acima do asfalto); o marcador fica no chão.
      jogo.posicaoMarcador = largada.posicao.clone().setY(largada.posicao.y - ALTURA_REPOSICIONAR);
      jogo.marcador = new MarcadorMissao(jogo.cena, jogo.posicaoMarcador, tuning.corrida.raioMarcador);
      jogo.recorde = lerRecorde(jogo.cenario.id);
      jogo.hudCorrida.mostrarPecas(pecasDaFase(jogo.cenario.id), jogo.cenario.totalPecas);
      if (jogo.proxima && faseEstaLiberada(jogo.proxima)) jogo.criarMarcadorViagem();
    }
    // Compila agora os "programas" de todos os materiais da fase. Sem isso, o
    // navegador compila cada um na 1ª vez que o objeto aparece na tela, e o
    // jogo dá um engasgo (o fps despenca por um instante) no meio da corrida.
    aoCompilar?.();
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
    const personagem = this.personagem;
    const aPe = personagem.ativo;
    if (aPe) this.acompanharPersonagem();
    // A pé, o carro fica estacionado e os comandos vão para o personagem.
    const comandos = aPe ? CARRO_ESTACIONADO : this.comandosDaCorrida(this.lerComandos());
    const comandosAPe = aPe ? this.lerComandosAPe() : null;
    const carro = this.carro;
    const fisico = carro.fisico;
    this.batidaNoQuadro = 0;
    const alfa = this.loop.avancar(dt, (passo) => {
      fisico.guardarEstadoAnterior();
      fisico.atualizar(passo, comandos);
      if (comandosAPe) {
        personagem.guardarEstadoAnterior();
        // O pulo vale para UM passo só (senão, num quadro com dois passos, pularia duas vezes).
        comandosAPe.pular = this.puloPendente;
        this.puloPendente = false;
        personagem.passoFisica(passo, comandosAPe);
      }
      this.preencherEstadoJogador(aPe);
      // O cenário reage a quem está no comando (carro ou personagem): o
      // trânsito freia, as peças e o troféu são pegos, e o que o carro vai
      // atingir vira objeto solto.
      this.cenario.passoFisica(passo, this.estadoCarro);
      const antes = fisico.corpo.linvel();
      this.fisica.passo();
      fisico.guardarEstado();
      if (aPe) personagem.guardarEstado();
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

    // Capotou: na corrida, volta para a pista; no passeio, só desvira ali
    // mesmo (o jogador pode estar longe da estrada de propósito).
    if (fisico.precisaReposicionar) {
      if (this.passeando) this.desvirar();
      else this.reposicionar();
    }

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
      motorLigado: !aPe,
    });
    this.efeitos.atualizar(dt, fisico, carro.visual.escapamentos, this.posDesenho, this.rotDesenho);

    // "Foco": quem a câmera segue, a sombra acompanha e o cenário desenha em volta.
    let foco = this.posDesenho;
    this.camera.aPe = aPe;
    if (aPe) {
      personagem.desenhar(dt, alfa);
      foco = personagem.pe;
      this.rotPersonagem.setFromAxisAngle(EIXO_Y, personagem.angulo);
      this.camera.atualizar(dt, foco, this.rotPersonagem, personagem.angulo, 0, false);
    } else {
      this.camera.atualizar(dt, this.posDesenho, this.rotDesenho, fisico.anguloHorizontal, fisico.velocidade, fisico.nitroLigado);
    }
    this.efeitos.ajustarEscala(this.camera.camera, this.renderizador.domElement.height);
    this.iluminacao.seguir(foco);
    this.ceu.atualizar(this.camera.camera.position, this.tempoTotal);
    this.cenario.atualizar(dt, this.camera.camera, this.renderizador.domElement.height, foco, alfa);
    this.verPecas();
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
    this.hud.mostrarAPe(aPe);

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
      if (t.apertou('abandonar') && this.corrida?.emProva) {
        this.corrida.voltarAoPasseio();
        this.definirPausa(false);
      }
      return;
    }
    if (this.corrida?.estado === 'chegou') {
      // Fim de fase: Enter volta a passear; N segue para a próxima fase;
      // M volta ao menu; T corre esta fase de novo (logo abaixo).
      if (t.apertou('confirmar')) {
        this.telaFim.esconder();
        this.corrida.voltarAoPasseio();
      }
      // N só segue viagem com a próxima fase liberada (tempo-meta batido).
      const proxima = this.proxima;
      if (t.apertou('proximaFase') && proxima && faseEstaLiberada(proxima)) irParaFase(proxima);
      if (t.apertou('menu')) irParaMenu();
    } else if (this.passeando && !this.personagem.ativo && t.apertou('confirmar')) {
      // Dentro de um marcador e devagar (e de carro!): viaja ou começa a corrida.
      const proxima = this.proxima;
      const v = this.infoViagem;
      const m = this.infoMarcador;
      if (this.marcadorViagem && proxima && v.dentro && !v.rapido) irParaFase(proxima);
      else if (m.dentro && !m.rapido) this.reiniciarCorrida();
    }
    if (t.apertou('trocarCamera')) this.camera.proximoModo();
    if (t.apertou('entrarSair')) this.entrarOuSair();
    if (t.apertou('reiniciar')) this.reiniciarCorrida();
    if (this.personagem.ativo) {
      // A pé, R leva de volta para o lado do carro (perdido, preso num buraco...).
      if (t.apertou('reposicionar')) this.personagemAoLadoDoCarro();
      // Guardado aqui e gasto no próximo passo de física (ver atualizar).
      if (t.apertou('freioMao')) this.puloPendente = true;
      return;
    }
    if (t.apertou('reposicionar')) this.reposicionar();
    if (t.apertou('carro1')) void this.trocarCarro('carro1');
    if (t.apertou('carro2')) void this.trocarCarro('carro2');
    if (t.apertou('carro3')) void this.trocarCarro('carro3');
  }

  // ---------------------------------------------------------------------------
  // A pé (Etapa 9)
  // ---------------------------------------------------------------------------

  /** Tecla E: desce do carro parado (só passeando) ou, a pé e perto dele, entra. */
  private entrarOuSair(): void {
    const f = this.carro.fisico;
    if (this.personagem.ativo) {
      if (this.personagem.pertoDe(f.posicaoAtual)) this.subirNoCarro();
      else this.hudCorrida?.avisar('🚗 Chegue perto do carro para entrar');
      return;
    }
    // Na corrida, descer seria trapaça (e o cronômetro continuaria correndo).
    if (!this.passeando) return;
    if (Math.abs(f.velocidade) * 3.6 > tuning.aPe.velocidadeParaDescerKmh) {
      this.hudCorrida?.avisar('✋ Pare o carro para descer');
      return;
    }
    this.personagemAoLadoDoCarro();
    this.camera.reiniciar();
  }

  /** Põe o personagem na porta do carro (descer, ou voltar com R / depois de cair na água). */
  private personagemAoLadoDoCarro(): void {
    const f = this.carro.fisico;
    this.personagem.descer(f.posicaoAtual, f.anguloHorizontal, this.carro.visual.geometria.meiasMedidas.x, f.corpo);
    this.puloPendente = false;
  }

  private subirNoCarro(): void {
    this.personagem.subir();
    this.camera.reiniciar();
  }

  /** A pé: W/S anda, A/D vira, Shift corre (Espaço pula: ver tratarTeclasDeUmToque). */
  private lerComandosAPe(): ComandosAPe {
    const t = this.entrada;
    return {
      frente: (t.segurando('acelerar') ? 1 : 0) - (t.segurando('frear') ? 1 : 0),
      giro: t.direcao(),
      correr: t.segurando('nitro'),
      pular: false,
    };
  }

  /** Caiu na água ou atravessou o chão a pé: volta para o lado do carro. */
  private acompanharPersonagem(): void {
    const p = this.personagem.centro;
    const chao = this.cenario.alturaChao(p.x, p.z);
    const caiu = this.cenario.naAgua(p) || (chao !== null && p.y < chao - tuning.passeio.abaixoDoChao) || p.y < -50;
    if (caiu) this.personagemAoLadoDoCarro();
  }

  /** O que o cenário enxerga neste passo: o carro, ou o personagem quando está a pé. */
  private preencherEstadoJogador(aPe: boolean): void {
    const e = this.estadoCarro;
    if (aPe) {
      e.posicao.copy(this.personagem.centro);
      e.rotacao.setFromAxisAngle(EIXO_Y, this.personagem.anguloAtual);
      e.velocidade.copy(this.personagem.velocidade);
      return;
    }
    const f = this.carro.fisico;
    const v = f.corpo.linvel();
    e.posicao.copy(f.posicaoAtual);
    e.rotacao.copy(f.rotacaoAtual);
    e.velocidade.set(v.x, v.y, v.z);
  }

  // ---------------------------------------------------------------------------
  // Corrida e pista
  // ---------------------------------------------------------------------------

  /** Passeando (sem cronômetro, mapa livre)? A pista de teste, sem corrida, conta como passeio. */
  private get passeando(): boolean {
    return (this.corrida?.estado ?? 'passeio') === 'passeio';
  }

  /**
   * Onde o carro está na pista? Serve para o cronômetro (cruzou a chegada?) e
   * para devolver à estrada quem saiu dela ou caiu da ponte.
   * No passeio, sair da pista é permitido: só volta quem caiu na água ou
   * atravessou o chão.
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
    let fora: boolean;
    let caiu: boolean;
    if (this.passeando) {
      // Longe da pista o carro pode estar num morro bem acima (ou num vale
      // abaixo) do asfalto: por isso aqui comparamos com o CHÃO, não com a pista.
      fora = false;
      const chao = this.cenario.alturaChao(posicao.x, posicao.z);
      caiu = this.cenario.naAgua(posicao) || (chao !== null && posicao.y < chao - tuning.passeio.abaixoDoChao);
    } else {
      fora = !livre && depoisDaBeira > r.distanciaForaPista;
      const nivelMar = this.cenario.nivelMar;
      caiu =
        posicao.y < tracado.alturaSuperficie(proj.indice, 0) - r.quedaAbaixoPista ||
        // Entrou no mar: volta na hora (carro não nada).
        (nivelMar !== null && posicao.y < nivelMar + r.alturaNoMar);
    }
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
    const passeando = corrida.estado === 'passeio';
    this.marcador?.mostrar(passeando);
    this.marcador?.atualizar(dt, this.infoMarcador.dentro);
    this.marcadorViagem?.mostrar(passeando);
    this.marcadorViagem?.atualizar(dt, this.infoViagem.dentro);
    if (passeando) this.atualizarMarcadores();
    const evento = corrida.atualizar(dt, this.distanciaNaPista);
    if (evento?.tipo === 'numero') this.audio.bip(false);
    if (evento?.tipo === 'largou') this.audio.bip(true);
    if (evento?.tipo === 'chegou') this.chegou(evento.tempo);
    this.hudCorrida?.atualizar(dt, corrida.estado, corrida.tempo, corrida.restante);
  }

  /** Cruzou a chegada: recorde, tempo-meta (libera a próxima fase?) e a tela de fim. */
  private chegou(tempo: number): void {
    const recordeNovo = registrarTempo(this.cenario.id, tempo);
    this.recorde = lerRecorde(this.cenario.id);
    if (this.recorde !== null) this.hudCorrida?.mostrarRecorde(this.recorde);

    const proxima = this.proxima;
    let viagem: SituacaoViagem | null = null;
    if (proxima) {
      const meta = this.cenario.tempoParaLiberar;
      const bateuMeta = meta !== null && tempo <= meta;
      const acabouDeLiberar = bateuMeta && liberarFase(FASES[proxima].id);
      if (acabouDeLiberar) {
        this.criarMarcadorViagem();
        this.audio.bip(true);
      }
      viagem = { proxima: FASES[proxima].nome, liberada: faseEstaLiberada(proxima), acabouDeLiberar, meta };
    }
    this.telaFim.mostrar(this.cenario.nome, tempo, this.recorde, recordeNovo, viagem);
  }

  /** Bússola e convites: onde estão os marcadores e se o carro está dentro de algum. */
  private atualizarMarcadores(): void {
    this.medirMarcador(this.posicaoMarcador, this.infoMarcador);
    this.hudCorrida?.mostrarBussola(this.infoMarcador);
    if (this.marcadorViagem) this.medirMarcador(this.posicaoViagem, this.infoViagem);
    this.hudCorrida?.mostrarConvite(this.conviteAtual());
  }

  /** O convite do marcador onde o carro está (ou null, fora de todos). */
  private conviteAtual(): Convite | null {
    const proxima = this.proxima;
    const v = this.infoViagem;
    // A pé, o marcador mostra o que é, mas viajar e correr é de carro.
    const aPe = this.personagem.ativo;
    const deCarro = 'Volte para o carro (<kbd>E</kbd>) e pare aqui';
    if (this.marcadorViagem && v.dentro && proxima) {
      return {
        rotulo: '🧭 SEGUIR VIAGEM',
        nome: FASES[proxima].nome,
        detalhe: FASES[proxima].local,
        acao: aPe ? deCarro : v.rapido ? 'Pare no marcador para viajar' : '<kbd>Enter</kbd> viajar &nbsp;·&nbsp; 🎮 <kbd>A</kbd>',
      };
    }
    const m = this.infoMarcador;
    if (!m.dentro) return null;
    const meta = this.cenario.tempoParaLiberar;
    const linhaMeta =
      proxima && meta !== null && !faseEstaLiberada(proxima)
        ? ` · Meta para liberar ${FASES[proxima].nome}: <b>${formatarTempo(meta)}</b>`
        : '';
    return {
      rotulo: '🏁 CORRIDA',
      nome: this.cenario.nome,
      detalhe: (this.recorde === null ? 'Sem recorde ainda' : `Recorde: ${formatarTempo(this.recorde)}`) + linhaMeta,
      acao: aPe ? deCarro : m.rapido ? 'Pare no marcador para correr' : '<kbd>Enter</kbd> correr &nbsp;·&nbsp; 🎮 <kbd>A</kbd>',
    };
  }

  /** Distância e direção de um marcador visto do carro. */
  private medirMarcador(posicao: Vector3, m: InfoMarcador): void {
    // A bússola aponta a partir de quem está no comando: o carro ou o personagem.
    const f = this.carro.fisico;
    const aPe = this.personagem.ativo;
    const origem = aPe ? this.personagem.centro : f.posicaoAtual;
    const dx = posicao.x - origem.x;
    const dz = posicao.z - origem.z;
    m.distancia = Math.hypot(dx, dz);
    // Os dois ângulos contam a partir do +Z, girando para o +X (que, olhando
    // para +Z, fica à ESQUERDA). Na tela, girar positivo é para a direita:
    // por isso o sinal de menos.
    let relativo = Math.atan2(dx, dz) - (aPe ? this.personagem.anguloAtual : f.anguloHorizontal);
    relativo = Math.atan2(Math.sin(relativo), Math.cos(relativo)); // volta para -π..π
    m.direcao = -relativo;
    m.dentro = m.distancia < tuning.corrida.raioMarcador;
    m.rapido = !aPe && Math.abs(f.velocidade) * 3.6 > tuning.corrida.velocidadeParaComecarKmh;
  }

  /** O marcador "seguir viagem" fica logo depois da linha de chegada. */
  private criarMarcadorViagem(): void {
    const tracado = this.cenario.tracado;
    const chegada = this.cenario.chegada;
    if (this.marcadorViagem || !tracado || chegada === null) return;
    this.posicaoViagem.copy(tracado.pontoAoLado(chegada + DEPOIS_DA_CHEGADA, 'centro', 0));
    this.marcadorViagem = new MarcadorMissao(this.cena, this.posicaoViagem, tuning.corrida.raioMarcador, COR_VIAGEM);
  }

  /** Pegou uma peça de tuning? Bônus no carro, aviso na tela e um "plim". */
  private verPecas(): void {
    const peca = this.cenario.colherPeca();
    if (!peca) return;
    aplicarBonusPeca(peca.tipo);
    const d = DESCRICAO_PECA[peca.tipo];
    this.hudCorrida?.avisar(`🔧 <b>${d.nome}</b> encontrado! <small>${d.efeito} · ${peca.coletadas}/${peca.total} peças</small>`);
    this.hudCorrida?.mostrarPecas(peca.coletadas, peca.total);
    this.audio.bip(true);
  }

  /** Encostou no troféu: libera o painel (para sempre) e liga a super velocidade. */
  private liberarModoDev(): void {
    const primeiraVez = liberarModoDev();
    this.painel.trocarValores(aplicarSuperVelocidade);
    this.mensagemEasterEgg.mostrar(primeiraVez);
    this.audio.bip(true);
  }

  /** A fase seguinte na ordem da viagem (lista FASES), ou null se esta é a última (ou na pista de teste). */
  private get proxima(): IdFase | null {
    return this.idFase === 'teste' ? null : proximaFase(this.idFase);
  }

  /** Vai para a largada e começa a contagem (vale para a 1ª vez e para "de novo"). */
  private reiniciarCorrida(): void {
    // A pé: entra no carro antes (corrida é de carro!).
    if (this.personagem.ativo) this.subirNoCarro();
    const { posicao, angulo } = this.cenario.largada;
    this.carro.fisico.reposicionar(posicao.clone(), angulo);
    this.camera.reiniciar();
    this.indiceNaPista = undefined;
    this.telaFim.esconder();
    this.corrida?.comecar();
    this.cenario.reiniciar();
    // Corrida nova, tanque cheio: senão o nitro gasto na anterior faria falta.
    this.carro.fisico.nitro = 1;
  }

  private definirPausa(pausado: boolean): void {
    this.pausado = pausado;
    this.telaPausa.mostrar(pausado, this.corrida?.emProva ?? false);
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

  /** Capotou no passeio: põe o carro de pé no mesmo lugar, apontando para onde estava. */
  private desvirar(): void {
    const f = this.carro.fisico;
    const posicao = f.posicaoAtual.clone();
    const chao = this.cenario.alturaChao(posicao.x, posicao.z);
    posicao.y = Math.max(posicao.y, chao ?? posicao.y) + ALTURA_REPOSICIONAR;
    f.reposicionar(posicao, f.anguloHorizontal);
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
