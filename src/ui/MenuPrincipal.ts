import './menu.css';
import creditosMd from '../../CREDITOS.md?raw';
import { QUALIDADES, type NivelQualidade } from '../config/quality';
import { Entrada } from '../core/Entrada';
import { lerEscolhas, salvarEscolhas, type Escolhas } from '../core/Escolhas';
import { irParaFase, type EstadoMenu } from '../core/Estados';
import { formatarTempo } from '../core/Corrida';
import { lerRecorde } from '../core/Recordes';
import { Garagem } from '../graphics/Garagem';
import { IDS_CARROS as CARROS, MODELOS } from '../world/assets';
import { FASES, FASE_INICIAL } from '../world/levels';
import { ORDEM_FASES, faseEstaLiberada } from '../core/Progresso';

// =============================================================================
// MENU PRINCIPAL
// =============================================================================
// Três telas, todas por cima da garagem 3D (ver Estados.ts):
//  - menu:          Jogar, qualidade e créditos, e o andamento da viagem;
//  - selecaoCarro:  a garagem, escolhendo o carro com ◀ ▶;
//  - creditos:      a tabela do CREDITOS.md.
//
// Funciona com teclado (setas, Enter, Esc), mouse e controle de videogame.
// O HTML é refeito do zero a cada mudança (desenhar()): para um menu tão
// pequeno, é mais simples que atualizar pedacinho por pedacinho.
// =============================================================================

const NIVEIS: readonly NivelQualidade[] = ['baixo', 'medio', 'alto'];
const OPCOES = ['jogar', 'qualidade', 'creditos'] as const;
type Opcao = (typeof OPCOES)[number];

export class MenuPrincipal {
  private readonly entrada = new Entrada();
  private readonly garagem: Garagem;
  private readonly raiz: HTMLDivElement;
  private estado: EstadoMenu = 'menu';
  private escolhas: Escolhas = lerEscolhas();
  private opcao: Opcao = 'jogar';
  private ultimoTempo = performance.now();

  private constructor() {
    this.garagem = new Garagem(this.escolhas.qualidade);
    this.raiz = document.createElement('div');
    this.raiz.className = 'menu';
    document.body.appendChild(this.raiz);
    // Um só "ouvinte" de cliques para o menu inteiro: cada botão diz o que
    // faz no atributo data-acao (ver desenhar()).
    this.raiz.addEventListener('click', (e) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
      if (alvo?.dataset.acao) this.executar(alvo.dataset.acao);
    });
  }

  static async criar(): Promise<MenuPrincipal> {
    const menu = new MenuPrincipal();
    // Só espera o carro escolhido; os outros chegam enquanto o jogador lê o menu.
    await menu.garagem.carregar(CARROS, menu.escolhas.carro);
    menu.desenhar();
    return menu;
  }

  iniciar(): void {
    const quadro = (agora: number): void => {
      const dt = Math.min((agora - this.ultimoTempo) / 1000, 0.1);
      this.ultimoTempo = agora;
      this.entrada.comecoDoQuadro();
      this.lerTeclas();
      this.garagem.atualizar(dt);
      this.entrada.fimDoQuadro();
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  // ---------------------------------------------------------------------------

  private lerTeclas(): void {
    const e = this.entrada;
    if (this.estado === 'menu') {
      if (e.apertou('cima')) this.moverOpcao(-1);
      if (e.apertou('baixo')) this.moverOpcao(1);
      if (e.apertou('esquerda')) this.mudarValor(-1);
      if (e.apertou('direita')) this.mudarValor(1);
      if (e.apertou('confirmar')) this.executar(this.opcao);
    } else if (this.estado === 'selecaoCarro') {
      if (e.apertou('esquerda')) this.executar('carro-anterior');
      if (e.apertou('direita')) this.executar('carro-proximo');
      if (e.apertou('confirmar')) this.executar('correr');
      if (e.apertou('voltar')) this.executar('voltar');
    } else {
      // Créditos: ↑ ↓ rolam a tabela.
      const tabela = this.raiz.querySelector('.menu-creditos-tabela');
      if (tabela && e.segurando('cima')) tabela.scrollTop -= 12;
      if (tabela && e.segurando('baixo')) tabela.scrollTop += 12;
      if (e.apertou('voltar') || e.apertou('confirmar')) this.executar('voltar');
    }
  }

  /** Tudo que o menu sabe fazer, por nome (vem das teclas ou do data-acao dos botões). */
  private executar(acao: string): void {
    switch (acao) {
      case 'jogar':
        this.irPara('selecaoCarro');
        break;
      case 'qualidade':
        this.opcao = acao;
        this.mudarValor(1);
        break;
      case 'qualidade-anterior':
        this.opcao = 'qualidade';
        this.mudarValor(-1);
        break;
      case 'creditos':
        this.irPara('creditos');
        break;
      case 'carro-anterior':
      case 'carro-proximo': {
        const i = CARROS.indexOf(this.escolhas.carro) + (acao === 'carro-proximo' ? 1 : -1);
        this.escolher({ carro: CARROS[(i + CARROS.length) % CARROS.length] });
        this.garagem.mostrar(this.escolhas.carro);
        break;
      }
      case 'correr':
        this.raiz.innerHTML = '<div class="menu-carregando">Carregando a fase…</div>';
        // A viagem começa sempre em Foz; as outras fases se alcançam dirigindo
        // (marcador "seguir viagem", depois de bater o tempo-meta).
        irParaFase(FASE_INICIAL);
        break;
      case 'voltar':
        this.irPara('menu');
        break;
    }
  }

  private irPara(estado: EstadoMenu): void {
    this.estado = estado;
    this.garagem.carroADireita(estado === 'menu');
    this.desenhar();
  }

  private moverOpcao(passo: number): void {
    const i = OPCOES.indexOf(this.opcao) + passo;
    this.opcao = OPCOES[(i + OPCOES.length) % OPCOES.length];
    this.desenhar();
  }

  /** ◀ ▶ na linha de qualidade: passa para a anterior/próxima. */
  private mudarValor(passo: number): void {
    if (this.opcao === 'qualidade') {
      const i = NIVEIS.indexOf(this.escolhas.qualidade) + passo;
      this.escolher({ qualidade: NIVEIS[(i + NIVEIS.length) % NIVEIS.length] });
    }
  }

  private escolher(mudancas: Partial<Escolhas>): void {
    this.escolhas = { ...this.escolhas, ...mudancas };
    salvarEscolhas(mudancas);
    this.desenhar();
  }

  // ---------------------------------------------------------------------------

  private desenhar(): void {
    if (this.estado === 'menu') this.raiz.innerHTML = this.htmlMenu();
    else if (this.estado === 'selecaoCarro') this.raiz.innerHTML = this.htmlGaragem();
    else this.raiz.innerHTML = this.htmlCreditos();
  }

  private htmlMenu(): string {
    const linha = (opcao: Opcao, conteudo: string): string =>
      `<div class="menu-opcao ${this.opcao === opcao ? 'ativa' : ''}" data-acao="${opcao}">${conteudo}</div>`;
    const seletor = (opcao: Opcao, rotulo: string, valor: string, detalhe: string): string =>
      linha(
        opcao,
        `<span class="menu-rotulo">${rotulo}</span>
         <span class="menu-valor"><b data-acao="${opcao}-anterior">◀</b> ${valor} <b data-acao="${opcao}">▶</b></span>
         <span class="menu-detalhe">${detalhe}</span>`,
      );
    return `
      <div class="menu-painel">
        <div class="menu-titulo">ROTA SUL</div>
        <div class="menu-subtitulo">Foz do Iguaçu → Navegantes</div>
        ${linha('jogar', '<span class="menu-jogar">JOGAR</span>')}
        ${htmlViagem()}
        ${seletor('qualidade', 'Qualidade', QUALIDADES[this.escolhas.qualidade].nome, 'Baixo: notebook com vídeo integrado')}
        ${linha('creditos', 'Créditos')}
        <div class="menu-dica"><kbd>↑</kbd><kbd>↓</kbd> escolher · <kbd>←</kbd><kbd>→</kbd> mudar · <kbd>Enter</kbd> confirmar · 🎮 também funciona</div>
      </div>`;
  }

  private htmlGaragem(): string {
    const nome = MODELOS[this.escolhas.carro].nome;
    const numero = CARROS.indexOf(this.escolhas.carro) + 1;
    return `
      <div class="menu-garagem">
        <div class="menu-garagem-topo">GARAGEM</div>
        <div class="menu-garagem-carro">
          <b class="menu-seta" data-acao="carro-anterior">◀</b>
          <div><div class="menu-garagem-numero">CARRO ${numero} DE ${CARROS.length}</div><div class="menu-garagem-nome">${nome}</div></div>
          <b class="menu-seta" data-acao="carro-proximo">▶</b>
        </div>
        <div class="menu-botoes">
          <button data-acao="voltar">Voltar <kbd>Esc</kbd></button>
          <button class="principal" data-acao="correr">Correr! <kbd>Enter</kbd></button>
        </div>
      </div>`;
  }

  private htmlCreditos(): string {
    const linhas = lerTabelaCreditos()
      .map((c) => `<tr>${c.map((celula) => `<td>${celula}</td>`).join('')}</tr>`)
      .join('');
    return `
      <div class="menu-creditos">
        <div class="menu-titulo pequeno">CRÉDITOS</div>
        <p>Um presente para o Enzo. Modelos 3D de autores que compartilharam o trabalho deles: obrigado!</p>
        <div class="menu-creditos-tabela"><table><tr><th>Modelo</th><th>Arquivo</th><th>Autor</th><th>Licença</th></tr>${linhas}</table></div>
        <p class="menu-detalhe"><kbd>↑</kbd><kbd>↓</kbd> rolar · lista completa (com imagens e bibliotecas) no arquivo CREDITOS.md.</p>
        <div class="menu-botoes"><button data-acao="voltar">Voltar <kbd>Esc</kbd></button></div>
      </div>`;
  }
}

/**
 * O andamento da viagem: cada fase na ordem, com o recorde (se já correu)
 * ou um cadeado (se ainda não foi liberada).
 */
function htmlViagem(): string {
  const etapas = ORDEM_FASES.map((id) => {
    const fase = FASES[id];
    if (!faseEstaLiberada(id)) return `<span class="menu-viagem-fase trancada">🔒 ${fase.nome}</span>`;
    const recorde = lerRecorde(fase.id);
    const tempo = recorde === null ? '' : `<small>${formatarTempo(recorde)}</small>`;
    return `<span class="menu-viagem-fase">${fase.nome}${tempo}</span>`;
  });
  return `<div class="menu-viagem">${etapas.join('<span class="menu-viagem-seta">→</span>')}</div>`;
}

/**
 * A tabela de modelos do CREDITOS.md, lida direto do arquivo (o "?raw" do
 * import faz o Vite entregar o texto). Assim existe UM lugar só para editar
 * os créditos: o .md, e a tela do jogo acompanha.
 */
function lerTabelaCreditos(): string[][] {
  return creditosMd
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Modelo |'))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => escaparHtml(c.trim().replace(/`/g, ''))),
    );
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
