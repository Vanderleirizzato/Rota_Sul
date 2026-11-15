// =============================================================================
// PROGRESSO DO DOWNLOAD DOS MODELOS
// =============================================================================
// Cada arquivo .glb avisa, enquanto baixa, quantos bytes já chegaram e quantos
// tem no total (o "onProgress" do carregador do three.js). Aqui juntamos os
// avisos de todos os arquivos numa conta só, para a barra de carregamento.
//
// Por que não dá para saber o total desde o começo? Porque os arquivos são
// pedidos aos poucos (cada parte da fase pede os seus). Então a barra mostra
// "arquivos prontos / arquivos pedidos" e os megabytes que já chegaram.
// =============================================================================

export interface Progresso {
  arquivosProntos: number;
  arquivosPedidos: number;
  /** Bytes já baixados e o total conhecido até agora (dos arquivos já pedidos). */
  bytesBaixados: number;
  bytesTotal: number;
}

type Ouvinte = (p: Progresso) => void;

const arquivos = new Map<string, { baixados: number; total: number; pronto: boolean }>();
const ouvintes = new Set<Ouvinte>();

export function aoProgredir(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Chamado pelo CarregadorModelos durante o download de cada arquivo. */
export function registrarProgresso(arquivo: string, baixados: number, total: number, pronto = false): void {
  const antes = arquivos.get(arquivo);
  // Alguns servidores não informam o tamanho total (total = 0): usamos o que já chegou.
  const totalConhecido = Math.max(total, baixados, antes?.total ?? 0);
  arquivos.set(arquivo, { baixados: pronto ? totalConhecido : baixados, total: totalConhecido, pronto: pronto || (antes?.pronto ?? false) });
  const p: Progresso = { arquivosProntos: 0, arquivosPedidos: arquivos.size, bytesBaixados: 0, bytesTotal: 0 };
  for (const a of arquivos.values()) {
    if (a.pronto) p.arquivosProntos++;
    p.bytesBaixados += a.baixados;
    p.bytesTotal += a.total;
  }
  for (const ouvinte of ouvintes) ouvinte(p);
}
