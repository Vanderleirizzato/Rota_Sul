import { QUALIDADE_PADRAO, type NivelQualidade } from '../config/quality';
import { IDS_CARROS, type IdCarro } from '../world/assets';

// =============================================================================
// ESCOLHAS DO JOGADOR (carro e qualidade)
// =============================================================================
// Ficam guardadas no navegador (localStorage): fechou o jogo e voltou, o
// menu já abre no carro e na qualidade de antes.
//
// Como no Recordes.ts, o localStorage pode falhar (janela anônima): então
// tudo fica em try/catch e, sem ele, valem as escolhas padrão.
// =============================================================================

export interface Escolhas {
  carro: IdCarro;
  qualidade: NivelQualidade;
}

const CHAVE = 'rotaSul.escolhas';
const PADRAO: Escolhas = { carro: 'carro1', qualidade: QUALIDADE_PADRAO };
const QUALIDADES: readonly NivelQualidade[] = ['baixo', 'medio', 'alto'];

export function lerEscolhas(): Escolhas {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Record<keyof Escolhas, unknown>>;
    // Confere cada valor: um dado velho (de uma versão antiga do jogo, por
    // exemplo um carro que não existe mais) não pode quebrar o jogo.
    return {
      carro: IDS_CARROS.find((c) => c === salvo.carro) ?? PADRAO.carro,
      qualidade: QUALIDADES.find((q) => q === salvo.qualidade) ?? PADRAO.qualidade,
    };
  } catch {
    return { ...PADRAO };
  }
}

/** Muda só o que foi passado e guarda. */
export function salvarEscolhas(mudancas: Partial<Escolhas>): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...lerEscolhas(), ...mudancas }));
  } catch {
    // sem armazenamento: as escolhas valem só até fechar o jogo
  }
}
