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

/**
 * Ondas do mar como "normal map": cada pixel diz para onde a superfície está
 * inclinada (vermelho = X, verde = Y, azul = "para cima"). O material usa isso
 * para refletir o sol e o céu em cada ondinha, sem nenhum triângulo a mais.
 *
 * A altura das ondas é uma soma de senos com um número INTEIRO de ondas no
 * quadro: assim a borda direita emenda com a esquerda e a textura repete sem
 * costura no mar inteiro.
 */
export function texturaOndas(): CanvasTexture {
  const tamanho = 256;
  const { canvas, ctx } = novoCanvas(tamanho);
  // [ondas em X, ondas em Y, força, fase]: ondas grandes e fracas + pequenas e mais fortes.
  const componentes: [number, number, number, number][] = [
    [2, 1, 1.0, 0.0],
    [-1, 3, 0.8, 1.3],
    [5, -2, 0.45, 2.1],
    [3, 7, 0.3, 0.7],
    [-8, 5, 0.22, 4.0],
    [11, 4, 0.15, 5.2],
  ];
  const imagem = ctx.createImageData(tamanho, tamanho);
  const doisPi = Math.PI * 2;
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      // Derivada da altura (inclinação) em X e em Y.
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, forca, fase] of componentes) {
        const c = Math.cos(doisPi * (kx * x + ky * y) / tamanho + fase) * forca;
        dx += c * kx;
        dy += c * ky;
      }
      const escala = 0.06;
      const nx = -dx * escala;
      const ny = -dy * escala;
      const comprimento = Math.hypot(nx, ny, 1);
      const k = (y * tamanho + x) * 4;
      imagem.data[k] = ((nx / comprimento) * 0.5 + 0.5) * 255;
      imagem.data[k + 1] = ((ny / comprimento) * 0.5 + 0.5) * 255;
      imagem.data[k + 2] = ((1 / comprimento) * 0.5 + 0.5) * 255;
      imagem.data[k + 3] = 255;
    }
  }
  ctx.putImageData(imagem, 0, 0);
  return repetivel(canvas, false);
}
