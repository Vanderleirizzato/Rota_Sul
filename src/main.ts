import { iniciarRapier } from './physics/MundoFisico';
import { Jogo } from './core/Jogo';
import { MenuPrincipal } from './ui/MenuPrincipal';

// Ponto de entrada. O endereço decide o que abre (ver core/Estados.ts):
//  - sem nada          → menu principal (com a garagem);
//  - ?fase=fase1, ...  → a corrida dessa fase;
//  - ?fase=teste       → a pista de teste de física (para desenvolvimento).
async function principal(): Promise<void> {
  const aviso = document.getElementById('carregando');
  try {
    if (!new URLSearchParams(window.location.search).has('fase')) {
      const menu = await MenuPrincipal.criar();
      aviso?.remove();
      menu.iniciar();
      return;
    }
    // A ordem importa: o Rapier (física em WebAssembly) precisa estar
    // carregado antes de qualquer corpo físico ser criado.
    await iniciarRapier();
    const jogo = await Jogo.criar();
    aviso?.remove();
    // Só no `npm run dev`: deixa o jogo acessível no console do navegador (F12)
    // como `jogo`, para inspecionar valores enquanto se testa. Some no build final.
    if (import.meta.env.DEV) Object.assign(window, { jogo });
    jogo.iniciar();
  } catch (erro) {
    console.error(erro);
    if (aviso) aviso.textContent = `Erro ao iniciar: ${erro instanceof Error ? erro.message : String(erro)}`;
  }
}

void principal();
