import type { IdFase } from '../world/levels';

// =============================================================================
// ESTADOS DO JOGO E COMO SE PASSA DE UM PARA OUTRO
// =============================================================================
//
//   Menu ──► Seleção de Personagem ──► Jogando ◄──► Pausa
//    ▲  ▲                                │
//    │  └──────── Fim de Fase ◄──────────┘
//    │               │
//    └───────────────┴──► próxima fase (Jogando de novo)
//
// O jogo tem duas "telas" grandes, cada uma com o seu código:
//  - a página do MENU (main.ts → MenuPrincipal): Menu, Seleção de
//    Personagem (a vitrine) e Créditos;
//  - a página da CORRIDA (main.ts → Jogo): Jogando, Pausa e Fim de Fase.
//
// Para ir de uma para a outra, recarregamos a página com outro endereço
// (?fase=fase2 abre a corrida da fase 2; sem nada, abre o menu). Por que
// recarregar em vez de trocar a cena na hora? Uma fase ocupa centenas de MB
// na placa de vídeo (modelos, texturas, sombras). Liberar tudo isso à mão é
// fácil de errar e, num notebook de vídeo integrado, um vazamento pequeno
// vira travada. Recarregando, o navegador limpa tudo de uma vez, e os
// arquivos .glb vêm do cache do navegador, rápido.
// =============================================================================

export type EstadoMenu = 'menu' | 'selecaoPersonagem' | 'creditos';
export type EstadoCorrida = 'jogando' | 'pausa' | 'fimDeFase';

export function irParaMenu(): void {
  window.location.href = window.location.pathname;
}

/** Abre a corrida da fase. O personagem e a qualidade vêm das Escolhas salvas. */
export function irParaFase(fase: IdFase | 'teste'): void {
  window.location.href = `${window.location.pathname}?fase=${fase}`;
}
