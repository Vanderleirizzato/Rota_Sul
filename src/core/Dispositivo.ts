// =============================================================================
// QUE APARELHO É ESTE?
// =============================================================================
// Celular e tablet não têm teclado: precisam dos botões na tela
// (ControlesToque) e de dicas que falem em "toque" em vez de teclas.
//
// Por que `(pointer: coarse)` e não "tem tela de toque?"? Muitos notebooks
// têm tela de toque, mas quem joga neles usa o teclado. "coarse" (grosso)
// quer dizer que o jeito PRINCIPAL de apontar é o dedo, que é impreciso.
// Para testar no PC: no Chrome, F12 → ícone de celular (modo dispositivo)
// e recarregar a página; o navegador passa a dizer que o ponteiro é o dedo.
// =============================================================================

export const TELA_DE_TOQUE = window.matchMedia('(pointer: coarse)').matches;

/** Escolhe o texto de uma dica conforme o aparelho (teclado ou toque). */
export function dica(teclado: string, toque: string): string {
  return TELA_DE_TOQUE ? toque : teclado;
}
