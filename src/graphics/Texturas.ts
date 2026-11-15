import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

// Texturas geradas por código, desenhando num <canvas>. Vantagens: não há
// arquivo de imagem para baixar, e dá para mudar o visual mexendo em números.

function novoCanvas(tamanho: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tamanho;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return { canvas, ctx };
}

function repetivel(canvas: HTMLCanvasElement, cor: boolean): CanvasTexture {
  const textura = new CanvasTexture(canvas);
  textura.wrapS = textura.wrapT = RepeatWrapping;
  // Textura de cor fica em sRGB; textura de "detalhe" (só claro/escuro) não.
  textura.colorSpace = cor ? SRGBColorSpace : NoColorSpace;
  // Anisotropia: deixa a textura nítida quando vista bem de lado (o asfalto
  // à frente do carro), em vez de virar um borrão.
  textura.anisotropy = 8;
  return textura;
}

/** Asfalto: cinza com granulado aleatório. */
export function texturaAsfalto(): CanvasTexture {
  const tamanho = 256;
  const { canvas, ctx } = novoCanvas(tamanho);
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(0, 0, tamanho, tamanho);
  for (let i = 0; i < 9000; i++) {
    const tom = 40 + Math.random() * 50;
    ctx.fillStyle = `rgb(${tom},${tom},${tom + 3})`;
    ctx.fillRect(Math.random() * tamanho, Math.random() * tamanho, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return repetivel(canvas, true);
}

/**
 * Detalhe de chão (grama/terra): manchas claras e escuras em tons de cinza.
 * Ela MULTIPLICA a cor de cada vértice do terreno, então a mesma textura serve
 * para grama, terra e pedra.
 */
export function texturaDetalheChao(): CanvasTexture {
  const tamanho = 256;
  const { canvas, ctx } = novoCanvas(tamanho);
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(0, 0, tamanho, tamanho);
  for (let i = 0; i < 14000; i++) {
    const tom = 150 + Math.random() * 105;
    ctx.fillStyle = `rgb(${tom},${tom},${tom})`;
    const x = Math.random() * tamanho;
    const y = Math.random() * tamanho;
    // Risquinhos verticais lembram folhas de grama.
    ctx.fillRect(x, y, 1, 1 + Math.random() * 3);
  }
  return repetivel(canvas, false);
}

/** Água: listras claras que, deslocadas a cada quadro, parecem correnteza. */
export function texturaAgua(): CanvasTexture {
  const tamanho = 128;
  const { canvas, ctx } = novoCanvas(tamanho);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tamanho, tamanho);
  for (let i = 0; i < 160; i++) {
    const tom = 175 + Math.random() * 80;
    ctx.fillStyle = `rgb(${tom},${tom},${tom})`;
    ctx.fillRect(Math.random() * tamanho, Math.random() * tamanho, 2 + Math.random() * 10, 1 + Math.random() * 2);
  }
  return repetivel(canvas, false);
}

/** Queda d'água: faixas verticais brancas e azuladas. */
export function texturaCachoeira(): CanvasTexture {
  const tamanho = 128;
  const { canvas, ctx } = novoCanvas(tamanho);
  ctx.fillStyle = '#cfe3ea';
  ctx.fillRect(0, 0, tamanho, tamanho);
  for (let i = 0; i < 260; i++) {
    const tom = 200 + Math.random() * 55;
    ctx.fillStyle = `rgba(${tom},${tom + 3},${tom + 6},0.9)`;
    ctx.fillRect(Math.random() * tamanho, Math.random() * tamanho, 1 + Math.random() * 2, 6 + Math.random() * 30);
  }
  return repetivel(canvas, true);
}
