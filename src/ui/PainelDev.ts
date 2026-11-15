import GUI from 'lil-gui';
import { tuning } from '../config/tuning';
import { QUALIDADES, type NivelQualidade } from '../config/quality';
import { aplicarSuperVelocidade, restaurarTuning } from '../core/ModoDev';

// Painel do Modo Dev: mexe nos valores de tuning.ts com o jogo rodando.
//
// O painel é montado automaticamente a partir do objeto `tuning`: cada seção
// vira uma pasta e cada número vira um controle deslizante. Quando alguém
// adicionar um parâmetro novo em tuning.ts, ele aparece aqui sozinho.
//
// No jogo publicado, ele só abre (F2) depois do easter egg do troféu
// (ver core/ModoDev.ts). No `npm run dev`, F2 abre sempre.

/** Faixas especiais. Os demais números vão de 0 ao triplo do valor inicial. */
const FAIXAS: Record<string, [number, number]> = {
  'motor.distribuicaoTraseira': [0, 1],
  'drift.aderenciaTraseiraFreioMao': [0, 1],
  'chassi.alturaCentroMassa': [-0.5, 1.5],
  'nitro.recargaPassiva': [0, 0.5],
  'nitro.recargaDrift': [0, 1],
  'reposicionamento.alturaQueda': [-200, 0],
};

export class PainelDev {
  private readonly gui: GUI;
  /** Quadros por segundo, mostrados no topo do painel (atualizado pelo Jogo). */
  private readonly medidor = { fps: 0 };
  private quadros = 0;
  private inicioContagem = performance.now();

  /**
   * @param aoMudarMassa chamado quando muda algo que exige recalcular a massa do
   *   carro (o resto é lido a cada passo e não precisa de aviso).
   * @param aoMudarQualidade chamado ao escolher outra qualidade gráfica.
   * @param aoMostrarColisores liga/desliga o desenho dos colisores físicos.
   * @param fases nome de cada fase → identificador (o que vai em ?fase= na URL).
   * @param faseAtual identificador da fase aberta agora.
   * @param qualidadeAtual a qualidade escolhida no menu.
   */
  constructor(
    aoMudarMassa: () => void,
    aoMudarQualidade: (nivel: NivelQualidade) => void,
    aoMostrarColisores: (mostrar: boolean) => void,
    fases: Record<string, string>,
    faseAtual: string,
    qualidadeAtual: NivelQualidade,
  ) {
    this.gui = new GUI({ title: 'Modo Dev: tuning (F2)' });
    // .listen() faz o painel reler o valor sozinho; .disable() impede edição.
    this.gui.add(this.medidor, 'fps').name('FPS').listen().disable();
    // Fase e qualidade também ficam no menu; aqui servem para testar rápido.
    const opcoes = Object.fromEntries(Object.entries(QUALIDADES).map(([nivel, q]) => [q.nome, nivel]));
    // Trocar de fase recarrega a página com ?fase=... (ver core/Estados.ts).
    this.gui
      .add({ fase: faseAtual }, 'fase', fases)
      .name('Fase')
      .onChange((id: string) => {
        window.location.search = `?fase=${id}`;
      });
    this.gui.add({ qualidade: qualidadeAtual }, 'qualidade', opcoes).name('Qualidade').onChange(aoMudarQualidade);
    // Desenha em linhas o que a FÍSICA enxerga (caixas, cascos, cilindros).
    // Bom para achar "obstáculo invisível": colisor que não bate com o desenho.
    this.gui.add({ colisores: false }, 'colisores').name('Mostrar colisores').onChange(aoMostrarColisores);
    for (const [secao, valores] of Object.entries(tuning)) {
      const pasta = this.gui.addFolder(secao);
      pasta.close();
      for (const [chave, valor] of Object.entries(valores)) {
        if (typeof valor !== 'number') continue;
        const [min, max] = FAIXAS[`${secao}.${chave}`] ?? [0, Math.max(1, Math.abs(valor) * 3)];
        // Cada seção do tuning é um objeto de números; o TypeScript não consegue
        // deduzir isso de Object.entries, então dizemos explicitamente.
        const controle = pasta.add(valores as Record<string, number>, chave, min, max);
        if (secao === 'chassi') controle.onFinishChange(aoMudarMassa);
      }
    }
    this.gui.add({ super: () => this.trocarValores(aplicarSuperVelocidade) }, 'super').name('🚀 Preset: super velocidade');
    this.gui.add({ normal: () => this.trocarValores(restaurarTuning) }, 'normal').name('↩ Voltar ao tuning original');
    this.gui.add({ copiar: () => this.copiarValores() }, 'copiar').name('📋 Copiar valores');
    this.gui.hide();
  }

  /** Chamar uma vez por quadro: conta os quadros e atualiza o FPS a cada meio segundo. */
  contarQuadro(): void {
    this.quadros++;
    const agora = performance.now();
    if (agora - this.inicioContagem >= 500) {
      this.medidor.fps = Math.round((this.quadros * 1000) / (agora - this.inicioContagem));
      this.quadros = 0;
      this.inicioContagem = agora;
    }
  }

  alternar(): void {
    this.gui.show(this.gui._hidden);
  }

  /** Muda o tuning "por fora" (preset) e faz os controles mostrarem os valores novos. */
  trocarValores(mudar: () => void): void {
    mudar();
    for (const controle of this.gui.controllersRecursive()) controle.updateDisplay();
  }

  /** Copia o tuning atual em formato de objeto TypeScript, para colar em tuning.ts. */
  private copiarValores(): void {
    const texto = `export const tuning = ${JSON.stringify(tuning, null, 2)};`;
    navigator.clipboard.writeText(texto).then(
      () => alert('Valores copiados! Cole em src/config/tuning.ts (mantendo os comentários que quiser).'),
      () => console.log(texto),
    );
  }
}
