import { SUPER_VELOCIDADE, tuning } from '../config/tuning';

// =============================================================================
// MODO DEV (o prêmio do troféu escondido no porto)
// =============================================================================
// O painel de tuning (F2) fica escondido no jogo "de verdade". Ele abre:
//  - sempre, no `npm run dev` (quem está programando precisa dele);
//  - depois que o jogador encosta no troféu escondido. O desbloqueio fica
//    guardado no navegador (localStorage): vale para sempre naquele navegador.
// =============================================================================

const CHAVE = 'rotaSul.modoDev';
/** Cópia do tuning como veio do tuning.ts, para o botão "voltar ao original". */
const ORIGINAL: typeof tuning = structuredClone(tuning);

export function modoDevLiberado(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(CHAVE) === 'liberado';
  } catch {
    return false;
  }
}

/** Guarda o desbloqueio. Devolve true se é a primeira vez (antes estava bloqueado). */
export function liberarModoDev(): boolean {
  let antes = false;
  try {
    antes = localStorage.getItem(CHAVE) === 'liberado';
    localStorage.setItem(CHAVE, 'liberado');
  } catch {
    // sem armazenamento: liberado só até fechar o jogo
  }
  return !antes;
}

/** Desfaz qualquer mudança (painel ou preset): volta aos números do tuning.ts. */
export function restaurarTuning(): void {
  for (const secao of Object.keys(ORIGINAL) as (keyof typeof tuning)[]) {
    Object.assign(tuning[secao], structuredClone(ORIGINAL[secao]));
  }
}

/**
 * Copia os valores do preset SUPER_VELOCIDADE (tuning.ts) para dentro do
 * tuning. Como o jogo lê o tuning a cada passo, o carro muda na hora.
 */
export function aplicarSuperVelocidade(): void {
  for (const [secao, valores] of Object.entries(SUPER_VELOCIDADE)) {
    Object.assign(tuning[secao as keyof typeof tuning], valores);
  }
}
