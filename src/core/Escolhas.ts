import { QUALIDADE_PADRAO, type NivelQualidade } from '../config/quality';
import { IDS_CARROS, IDS_PERSONAGENS, type IdCarro, type IdPersonagem } from '../world/assets';

// =============================================================================
// ESCOLHAS DO JOGADOR (personagem, carro e qualidade)
// =============================================================================
// Ficam guardadas no navegador (localStorage): fechou o jogo e voltou, o
// menu já abre no personagem e na qualidade de antes. O carro não se
// escolhe no menu: é o último dos três em que o jogador entrou no jogo.
//
// Como no Recordes.ts, o localStorage pode falhar (janela anônima): então
// tudo fica em try/catch e, sem ele, valem as escolhas padrão.
// =============================================================================

export interface Escolhas {
  personagem: IdPersonagem;
  carro: IdCarro;
  qualidade: NivelQualidade;
}

const CHAVE = 'rotaSul.escolhas';
const PADRAO: Escolhas = { personagem: 'homem', carro: 'carro1', qualidade: QUALIDADE_PADRAO };
const QUALIDADES: readonly NivelQualidade[] = ['baixo', 'medio', 'alto'];

export function lerEscolhas(): Escolhas {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Record<keyof Escolhas, unknown>>;
    // Confere cada valor: um dado velho (de uma versão antiga do jogo, por
    // exemplo um carro que não existe mais) não pode quebrar o jogo.
    return {
      personagem: IDS_PERSONAGENS.find((p) => p === salvo.personagem) ?? PADRAO.personagem,
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
