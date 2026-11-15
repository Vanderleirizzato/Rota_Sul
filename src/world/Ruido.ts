// Ruído para gerar relevo e variações "naturais" (morros, cor da grama).
//
// Math.random() daria pontos sem relação entre si: um morro de 30 m ao lado de
// um buraco. O ruído de valor sorteia alturas só nos cantos de uma grade e
// interpola suavemente entre eles, então pontos vizinhos têm valores
// parecidos. Somando várias "oitavas" (grades cada vez mais finas e fracas),
// surgem morros grandes com ondulações pequenas por cima.

/** Número pseudoaleatório fixo para cada canto da grade (sempre o mesmo resultado). */
function sorteioDoCanto(x: number, z: number, semente: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(semente, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Curva em "S": deixa a interpolação sem quinas. */
function suave(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Ruído de valor 2D, entre 0 e 1. `escala` é o tamanho (m) de cada célula da grade. */
export function ruido2D(x: number, z: number, escala: number, semente = 1): number {
  const gx = x / escala;
  const gz = z / escala;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = suave(gx - x0);
  const tz = suave(gz - z0);
  const a = sorteioDoCanto(x0, z0, semente);
  const b = sorteioDoCanto(x0 + 1, z0, semente);
  const c = sorteioDoCanto(x0, z0 + 1, semente);
  const d = sorteioDoCanto(x0 + 1, z0 + 1, semente);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/** Soma de 3 oitavas: relevo com detalhe. Resultado entre 0 e 1. */
export function ruidoMorros(x: number, z: number, escala: number, semente = 1): number {
  return (
    ruido2D(x, z, escala, semente) * 0.6 +
    ruido2D(x, z, escala / 2.3, semente + 1) * 0.28 +
    ruido2D(x, z, escala / 5.1, semente + 2) * 0.12
  );
}

/**
 * Sorteio com semente: a mesma fase sempre gera as mesmas árvores no mesmo
 * lugar. Com Math.random() a floresta mudaria a cada vez que o jogo abre.
 */
export function criarSorteio(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    // "mulberry32": gerador pequeno e bom o bastante para jogos.
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Transição suave de 0 (em `de`) a 1 (em `ate`). */
export function transicao(de: number, ate: number, valor: number): number {
  const t = Math.min(Math.max((valor - de) / (ate - de), 0), 1);
  return suave(t);
}
