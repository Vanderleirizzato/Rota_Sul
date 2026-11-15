import { tuning } from '../config/tuning';
import { FASES, type IdFase } from '../world/levels';
import type { TipoPeca } from '../world/levels/TiposFase';

// =============================================================================
// PROGRESSO DA VIAGEM: fases liberadas e peças de tuning coletadas.
// =============================================================================
// Fica no navegador (localStorage), como os recordes.
//
// Por que guardar o NOME (id) de cada fase liberada, e não "liberou até a
// fase 2"? Porque a lista de fases vai crescer no meio: se alguém criar
// Cascavel entre Foz e Navegantes, "fase 2" passaria a ser Cascavel, e quem já
// tinha liberado Navegantes perderia o acesso. Com o id, Navegantes continua
// liberada, e Cascavel aparece como novidade.
//
// As peças são guardadas como "id-da-fase:número:tipo" (ex.:
// "fase1-foz:2:turbo"): o tipo vai junto para o bônus poder ser calculado
// sem precisar abrir a fase.
// =============================================================================

interface ProgressoSalvo {
  liberadas: string[];
  pecas: string[];
}

const CHAVE = 'rotaSul.progresso';

function ler(): ProgressoSalvo {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Record<keyof ProgressoSalvo, unknown>>;
    // Confere o formato: um dado estranho não pode quebrar o jogo.
    const listaDeTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { liberadas: listaDeTextos(salvo.liberadas), pecas: listaDeTextos(salvo.pecas) };
  } catch {
    return { liberadas: [], pecas: [] };
  }
}

function gravar(p: ProgressoSalvo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // sem armazenamento (janela anônima): o progresso vale só até fechar o jogo
  }
}

/** A fase está liberada? A primeira da viagem sempre está (quem chama passa `primeira`). */
export function faseLiberada(id: string, primeira: boolean): boolean {
  return primeira || ler().liberadas.includes(id);
}

/** Libera a fase. Devolve true se ela acabou de ser liberada (antes estava trancada). */
export function liberarFase(id: string): boolean {
  const p = ler();
  if (p.liberadas.includes(id)) return false;
  p.liberadas.push(id);
  gravar(p);
  return true;
}

/** Identificador de uma peça (ver o comentário do topo). */
export function idPeca(idFase: string, indice: number, tipo: TipoPeca): string {
  return `${idFase}:${indice}:${tipo}`;
}

export function pecaColetada(id: string): boolean {
  return ler().pecas.includes(id);
}

/** Guarda a peça. Devolve true se é nova (antes não estava guardada). */
export function guardarPeca(id: string): boolean {
  const p = ler();
  if (p.pecas.includes(id)) return false;
  p.pecas.push(id);
  gravar(p);
  return true;
}

/** Quantas peças desta fase já foram coletadas. */
export function pecasDaFase(idFase: string): number {
  return ler().pecas.filter((id) => id.startsWith(`${idFase}:`)).length;
}

// -----------------------------------------------------------------------------
// Bônus das peças
// -----------------------------------------------------------------------------

/**
 * Aplica no tuning o bônus de UMA peça. Multiplica o valor atual: assim o
 * bônus soma com o que estiver no tuning (inclusive mudanças do painel F2).
 */
export function aplicarBonusPeca(tipo: TipoPeca): void {
  const fator = 1 + tuning.pecas[tipo];
  if (tipo === 'turbo') tuning.motor.forca *= fator;
  if (tipo === 'pneus') {
    tuning.aderencia.dianteira *= fator;
    tuning.aderencia.traseira *= fator;
  }
  if (tipo === 'nitro') tuning.nitro.duracao *= fator;
}

/**
 * Aplica o bônus de TODAS as peças já coletadas (em qualquer fase). Chamar
 * ao abrir uma fase e depois de "voltar ao tuning original" no painel F2,
 * que apaga os bônus junto com o resto.
 */
export function aplicarBonusDeTodasAsPecas(): void {
  for (const id of ler().pecas) {
    const tipo = id.split(':').pop();
    if (tipo === 'turbo' || tipo === 'pneus' || tipo === 'nitro') aplicarBonusPeca(tipo);
  }
}

// -----------------------------------------------------------------------------
// A viagem: a ordem das fases vem da lista FASES (levels/index.ts)
// -----------------------------------------------------------------------------

/** As fases na ordem da viagem. */
export const ORDEM_FASES = Object.keys(FASES) as IdFase[];

/** A fase seguinte na viagem, ou null se esta é a última. */
export function proximaFase(id: IdFase): IdFase | null {
  const i = ORDEM_FASES.indexOf(id);
  return i >= 0 && i + 1 < ORDEM_FASES.length ? ORDEM_FASES[i + 1] : null;
}

/**
 * FASE DE TESTE: com `true`, todas as cidades ficam liberadas (e dá para
 * escolher a cidade no menu), sem precisar bater o tempo-meta. Quando o jogo
 * estiver pronto, volte para `false`: aí a viagem se libera dirigindo.
 */
export const TODAS_LIBERADAS_PARA_TESTE = true;

/** A fase está liberada? (A primeira da viagem sempre está.) */
export function faseEstaLiberada(id: IdFase): boolean {
  if (TODAS_LIBERADAS_PARA_TESTE) return true;
  return faseLiberada(FASES[id].id, id === ORDEM_FASES[0]);
}
