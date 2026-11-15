import { iniciarRapier } from './physics/MundoFisico';
import { Jogo } from './core/Jogo';

// Ponto de entrada. A ordem importa: o Rapier (física em WebAssembly) precisa
// estar carregado antes de qualquer corpo físico ser criado.
async function principal(): Promise<void> {
  const aviso = document.getElementById('carregando');
  try {
    await iniciarRapier();
    const jogo = await Jogo.criar();
    aviso?.remove();
    jogo.iniciar();
  } catch (erro) {
    console.error(erro);
    if (aviso) aviso.textContent = `Erro ao iniciar: ${erro instanceof Error ? erro.message : String(erro)}`;
  }
}

void principal();
