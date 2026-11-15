import { defineConfig } from 'vite';

// Configuração mínima do Vite. A Etapa 6 (publicação) vai ajustar o `base`.
export default defineConfig({
  server: { open: true },
  build: {
    // O Rapier traz a física em WebAssembly embutida no JavaScript (~2 MB),
    // então o pacote passa do limite padrão de aviso (500 kB) de propósito.
    chunkSizeWarningLimit: 6000,
  },
});
