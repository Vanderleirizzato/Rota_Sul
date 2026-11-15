import { defineConfig } from 'vite';

// Configuração do Vite.
export default defineConfig({
  // Caminhos relativos ("./assets/...") em vez de absolutos ("/assets/..."):
  // assim o jogo funciona em qualquer pasta do servidor, seja a raiz de um
  // subdomínio da Hostinger ou uma subpasta, sem precisar recompilar.
  base: './',
  server: { open: true },
  build: {
    // O Rapier traz a física em WebAssembly embutida no JavaScript (~2 MB),
    // então o pacote passa do limite padrão de aviso (500 kB) de propósito.
    chunkSizeWarningLimit: 6000,
  },
});
