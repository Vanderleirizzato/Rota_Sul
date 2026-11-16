import './menu.css';
import creditosMd from '../../CREDITOS.md?raw';
import { NIVEIS_QUALIDADE as NIVEIS, QUALIDADES } from '../config/quality';
import { Entrada } from '../core/Entrada';
import { dica } from '../core/Dispositivo';
import { lerEscolhas, salvarEscolhas, type Escolhas } from '../core/Escolhas';
import { irParaFase, type EstadoMenu } from '../core/Estados';
import { formatarTempo } from '../core/Corrida';
import { lerRecorde } from '../core/Recordes';
import { Vitrine } from '../graphics/Vitrine';
import { IDS_PERSONAGENS as PERSONAGENS_MENU, PERSONAGENS } from '../world/assets';
import { FASES, FASE_INICIAL, type IdFase } from '../world/levels';
import { ORDEM_FASES, faseEstaLiberada } from '../core/Progresso';

// =============================================================================
// MENU PRINCIPAL
// =============================================================================
// Três telas, todas por cima da vitrine 3D (ver Estados.ts):
//  - menu:               Jogar, qualidade e créditos, e o andamento da viagem;
//  - selecaoPersonagem:  a vitrine, escolhendo o personagem com ◀ ▶;
//  - creditos:           a tabela do CREDITOS.md.
// O carro não se escolhe aqui: os três ficam estacionados no jogo, e o
// jogador anda até o que quiser.
//
// Funciona com teclado (setas, Enter, Esc), mouse e controle de videogame.
// O HTML é refeito do zero a cada mudança (desenhar()): para um menu tão
// pequeno, é mais simples que atualizar pedacinho por pedacinho.
// =============================================================================

const OPCOES = ['jogar', 'cidade', 'qualidade', 'creditos'] as const;
type Opcao = (typeof OPCOES)[number];

export class MenuPrincipal {
  private readonly entrada = new Entrada();
  private readonly vitrine: Vitrine;
  private readonly raiz: HTMLDivElement;
  private estado: EstadoMenu = 'menu';
  private escolhas: Escolhas = lerEscolhas();
  private opcao: Opcao = 'jogar';
  /** Em que cidade começar: só as liberadas (a viagem normal começa em Foz). */
  private fase: IdFase = FASE_INICIAL;
  private ultimoTempo = performance.now();

  private constructor() {
    this.vitrine = new Vitrine(this.escolhas.qualidade);
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
    // Só espera o personagem escolhido; os outros chegam enquanto o jogador lê o menu.
    await menu.vitrine.carregar(PERSONAGENS_MENU, menu.escolhas.personagem);
    menu.desenhar();
    return menu;
  }

  iniciar(): void {
    const quadro = (agora: number): void => {
      const dt = Math.min((agora - this.ultimoTempo) / 1000, 0.1);
      this.ultimoTempo = agora;
      this.entrada.comecoDoQuadro();
      this.lerTeclas();
      this.vitrine.atualizar(dt);
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
    } else if (this.estado === 'selecaoPersonagem') {
      if (e.apertou('esquerda')) this.executar('personagem-anterior');
      if (e.apertou('direita')) this.executar('personagem-proximo');
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
        this.irPara('selecaoPersonagem');
        break;
      case 'qualidade':
        this.opcao = acao;
        this.mudarValor(1);
        break;
      case 'cidade':
        this.opcao = acao;
        this.mudarValor(1);
        break;
      case 'cidade-anterior':
        this.opcao = 'cidade';
        this.mudarValor(-1);
        break;
      case 'qualidade-anterior':
        this.opcao = 'qualidade';
        this.mudarValor(-1);
        break;
      case 'creditos':
        this.irPara('creditos');
        break;
      case 'personagem-anterior':
      case 'personagem-proximo': {
        const lista = PERSONAGENS_MENU;
        const i = lista.indexOf(this.escolhas.personagem) + (acao === 'personagem-proximo' ? 1 : -1);
        this.escolher({ personagem: lista[(i + lista.length) % lista.length] });
        this.vitrine.mostrar(this.escolhas.personagem);
        break;
      }
      case 'correr':
        this.raiz.innerHTML = '<div class="menu-carregando">Carregando a fase…</div>';
        // A cidade escolhida no menu (só as liberadas aparecem lá). Normalmente
        // é Foz; as outras se alcançam dirigindo (marcador "seguir viagem").
        irParaFase(this.fase);
        break;
      case 'voltar':
        this.irPara('menu');
        break;
    }
  }

  private irPara(estado: EstadoMenu): void {
    this.estado = estado;
    this.vitrine.aDireita(estado === 'menu');
    this.desenhar();
  }

  private moverOpcao(passo: number): void {
    const i = OPCOES.indexOf(this.opcao) + passo;
    this.opcao = OPCOES[(i + OPCOES.length) % OPCOES.length];
    this.desenhar();
  }

  /** ◀ ▶ nas linhas de cidade e de qualidade: passa para a anterior/próxima. */
  private mudarValor(passo: number): void {
    if (this.opcao === 'cidade') {
      const liberadas = ORDEM_FASES.filter(faseEstaLiberada);
      const i = liberadas.indexOf(this.fase) + passo;
      this.fase = liberadas[(i + liberadas.length) % liberadas.length];
      this.desenhar();
    }
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
    else if (this.estado === 'selecaoPersonagem') this.raiz.innerHTML = this.htmlEscolha();
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
        ${seletor('cidade', 'Cidade', FASES[this.fase].nome, FASES[this.fase].local)}
        ${seletor('qualidade', 'Qualidade', QUALIDADES[this.escolhas.qualidade].nome, QUALIDADES[this.escolhas.qualidade].descricao)}
        ${linha('creditos', 'Créditos')}
        <div class="menu-dica so-teclado"><kbd>↑</kbd><kbd>↓</kbd> escolher · <kbd>←</kbd><kbd>→</kbd> mudar · <kbd>Enter</kbd> confirmar · 🎮 também funciona</div>
      </div>`;
  }

  private htmlEscolha(): string {
    const lista = PERSONAGENS_MENU;
    const nome = PERSONAGENS[this.escolhas.personagem].nome;
    const numero = lista.indexOf(this.escolhas.personagem) + 1;
    return `
      <div class="menu-escolha">
        <div class="menu-escolha-topo">QUEM VAI VIAJAR?</div>
        <div class="menu-escolha-item">
          <b class="menu-seta" data-acao="personagem-anterior">◀</b>
          <div><div class="menu-escolha-numero">PERSONAGEM ${numero} DE ${lista.length}</div><div class="menu-escolha-nome">${nome}</div></div>
          <b class="menu-seta" data-acao="personagem-proximo">▶</b>
        </div>
        <div class="menu-escolha-dica">Os seus 3 carros estão estacionados no jogo: ande até um e aperte ${dica('<kbd>E</kbd>', 'o botão 🚗')}.</div>
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
