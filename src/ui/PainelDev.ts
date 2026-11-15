import GUI from 'lil-gui';
import { tuning } from '../config/tuning';

// Painel do Modo Dev: mexe nos valores de tuning.ts com o jogo rodando.
//
// O painel é montado automaticamente a partir do objeto `tuning`: cada seção
// vira uma pasta e cada número vira um controle deslizante. Quando alguém
// adicionar um parâmetro novo em tuning.ts, ele aparece aqui sozinho.
//
// Na Etapa 5, ele fica escondido até o easter egg do troféu. Por enquanto,
// F2 abre e fecha.

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

  /**
   * @param aoMudarMassa chamado quando muda algo que exige recalcular a massa do
   *   carro (o resto é lido a cada passo e não precisa de aviso).
   */
  constructor(aoMudarMassa: () => void) {
    this.gui = new GUI({ title: 'Modo Dev: tuning (F2)' });
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
    this.gui.add({ copiar: () => this.copiarValores() }, 'copiar').name('📋 Copiar valores');
    this.gui.hide();
  }

  alternar(): void {
    this.gui.show(this.gui._hidden);
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
