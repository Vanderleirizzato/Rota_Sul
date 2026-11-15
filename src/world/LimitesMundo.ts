import type { MundoFisico } from '../physics/MundoFisico';
import type { Terreno } from './Terreno';

// =============================================================================
// LIMITES DO MUNDO: quatro paredes invisíveis em volta do terreno.
// =============================================================================
// No passeio o carro anda livre pelo mapa, sem voltar sozinho para a pista.
// Mas o terreno acaba em algum lugar: depois da última linha da grade não
// existe chão, e o carro cairia no vazio (o CLAUDE.md proíbe cair para fora
// do mundo). As paredes ficam um pouco para dentro da borda, então o carro
// para enquanto ainda há chão debaixo dele.
//
// Por que invisíveis? Lá na borda o terreno já virou montanha alta (ver
// "subidaAoLonge" nos biomas): quase ninguém chega até ela, e um muro de
// verdade apareceria de longe, no horizonte.
// =============================================================================

/** Quanto (m) as paredes ficam para dentro da borda do terreno. */
export const RECUO_LIMITES = 16;
/** Altura das paredes (m): bem mais alta que qualquer montanha, para ninguém pular por cima. */
const ALTURA = 600;
/** Espessura das paredes (m): grossa, para o carro em alta velocidade não atravessar num passo de física. */
const ESPESSURA = 10;

export function colocarLimites(fisica: MundoFisico, terreno: Terreno): void {
  const { minX, maxX, minZ, maxZ } = terreno.limites;
  const x0 = minX + RECUO_LIMITES;
  const x1 = maxX - RECUO_LIMITES;
  const z0 = minZ + RECUO_LIMITES;
  const z1 = maxZ - RECUO_LIMITES;
  const meioX = (x0 + x1) / 2;
  const meioZ = (z0 + z1) / 2;
  const meiaLarguraX = (x1 - x0) / 2 + ESPESSURA;
  const meiaLarguraZ = (z1 - z0) / 2 + ESPESSURA;
  const y = 0;
  const meiaAltura = ALTURA / 2;
  const meiaEspessura = ESPESSURA / 2;
  // Cada parede fica "do lado de fora" da linha, para não roubar espaço do mapa.
  fisica.criarCaixaFixa({ x: x0 - meiaEspessura, y, z: meioZ }, meiaEspessura, meiaAltura, meiaLarguraZ); // oeste
  fisica.criarCaixaFixa({ x: x1 + meiaEspessura, y, z: meioZ }, meiaEspessura, meiaAltura, meiaLarguraZ); // leste
  fisica.criarCaixaFixa({ x: meioX, y, z: z0 - meiaEspessura }, meiaLarguraX, meiaAltura, meiaEspessura); // norte
  fisica.criarCaixaFixa({ x: meioX, y, z: z1 + meiaEspessura }, meiaLarguraX, meiaAltura, meiaEspessura); // sul
}
