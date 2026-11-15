// Melhor tempo de cada fase, guardado no navegador (localStorage).
//
// O localStorage pode falhar (janela anônima, armazenamento bloqueado): por
// isso tudo fica dentro de try/catch. Sem ele, o jogo funciona igual; só não
// lembra o recorde.

const PREFIXO = 'rotaSul.recorde.';

export function lerRecorde(idFase: string): number | null {
  try {
    const valor = localStorage.getItem(PREFIXO + idFase);
    return valor === null ? null : Number(valor);
  } catch {
    return null;
  }
}

/** Guarda o tempo se for o melhor. Devolve true quando é recorde novo. */
export function registrarTempo(idFase: string, tempo: number): boolean {
  const anterior = lerRecorde(idFase);
  if (anterior !== null && anterior <= tempo) return false;
  try {
    localStorage.setItem(PREFIXO + idFase, String(tempo));
  } catch {
    // sem armazenamento: o recorde vale só até fechar o jogo
  }
  return true;
}
