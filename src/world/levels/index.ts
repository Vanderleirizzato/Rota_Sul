import { FASE1_FOZ } from './fase1-foz';
import type { DadosFase } from './TiposFase';

// Lista de fases do jogo, na ordem da viagem (Foz do Iguaçu → Navegantes).
// Ao criar uma fase nova, importe o arquivo dela e acrescente aqui.
export const FASES = {
  fase1: FASE1_FOZ,
} satisfies Record<string, DadosFase>;

export type IdFase = keyof typeof FASES;

/** A fase que abre ao iniciar o jogo (até o menu de fases, na Etapa 5). */
export const FASE_INICIAL: IdFase = 'fase1';
