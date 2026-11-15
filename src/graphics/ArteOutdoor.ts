import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ArteOutdoor } from '../world/levels/TiposFase';

// =============================================================================
// ARTES DOS OUTDOORS (pintadas no código, num <canvas>)
// =============================================================================
// Cada arte é uma função que desenha num canvas de 1024 × 512 (a proporção
// do painel do outdoor). As imagens (logo da Dale, foto da Moda Verão)
// carregam em segundo plano: o outdoor aparece com o texto e a imagem
// "entra" quando chega (textura.needsUpdate = true manda a placa de vídeo
// reler o canvas).
//
// Para criar uma arte nova: escreva uma função aqui, acrescente o nome dela
// no tipo ArteOutdoor (levels/TiposFase.ts) e na lista ARTES, lá embaixo.
// =============================================================================

const LARGURA = 1024;
const ALTURA = 512;
const PASTA = 'models/outdoor/';

/** Cores da marca Dale (tiradas do logo). */
const ROSA_DALE = '#f47b88';
const CREME_DALE = '#fff4c4';

type Pintor = (g: CanvasRenderingContext2D, textura: CanvasTexture) => void;

export function criarArte(arte: ArteOutdoor): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível.');
  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 4;
  ARTES[arte](g, textura);
  return textura;
}

// --- artes -------------------------------------------------------------------

/** "Cuidado: bugs na pista" no estilo placa de advertência (amarelo e preto). */
const bugs: Pintor = (g) => {
  g.fillStyle = '#ffcc00';
  g.fillRect(0, 0, LARGURA, ALTURA);
  listrasDeObra(g, 0, 40);
  listrasDeObra(g, ALTURA - 40, 40);
  // Losango de advertência com um "bug" dentro.
  g.save();
  g.translate(190, ALTURA / 2);
  g.rotate(Math.PI / 4);
  g.fillStyle = '#111';
  g.fillRect(-115, -115, 230, 230);
  g.fillStyle = '#ffcc00';
  g.fillRect(-100, -100, 200, 200);
  g.restore();
  g.font = '150px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('🐛', 190, ALTURA / 2 + 8);
  g.fillStyle = '#111';
  g.textAlign = 'left';
  g.font = '900 92px Arial Black, Arial, sans-serif';
  g.fillText('CUIDADO:', 360, 170);
  g.font = '900 64px Arial Black, Arial, sans-serif';
  g.fillText('BUGS NA PISTA', 360, 270);
  g.fillText('À FRENTE', 360, 345);
  g.font = 'italic 30px Arial, sans-serif';
  g.fillText('(rode os testes antes de passar)', 362, 410);
};

/** Anúncio de vaga, com cara de tela de programação. */
const devAds: Pintor = (g) => {
  g.fillStyle = '#0d1b2a';
  g.fillRect(0, 0, LARGURA, ALTURA);
  g.textBaseline = 'middle';
  g.font = '28px Consolas, monospace';
  g.fillStyle = '#4fc3f7';
  g.fillText('const vaga = {', 60, 70);
  g.fillStyle = '#ffcc33';
  g.font = '900 96px Arial Black, Arial, sans-serif';
  g.fillText('PROCURA-SE', 60, 165);
  g.fillStyle = '#fff';
  g.font = 'bold 54px Arial, sans-serif';
  g.fillText('Dev de ADS para', 60, 260);
  g.fillText('tunar este motor', 60, 325);
  g.font = '28px Consolas, monospace';
  g.fillStyle = '#9ccc65';
  g.fillText('// requisitos: café, git e paciência com bugs', 60, 400);
  g.fillStyle = '#4fc3f7';
  g.fillText('}; // currículo: abra o tuning.ts 😉', 60, 450);
  // Uma engrenagem simples à direita.
  g.save();
  g.translate(870, 230);
  g.fillStyle = '#33e1ff';
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.fillRect(-18, -120, 36, 50);
  }
  g.beginPath();
  g.arc(0, 0, 85, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0d1b2a';
  g.beginPath();
  g.arc(0, 0, 38, 0, Math.PI * 2);
  g.fill();
  g.restore();
};

/** Dale Congelados Saudáveis: o logo grande no rosa da marca. */
const dale: Pintor = (g, textura) => {
  fundoDale(g);
  g.fillStyle = CREME_DALE;
  g.textAlign = 'center';
  g.font = '600 40px Georgia, serif';
  g.fillText('Navegantes · SC', LARGURA / 2, 440);
  desenharImagem(`${PASTA}logo01-removebg-preview-1.webp`, textura, (img) => {
    // O logo tem fundo transparente: o rosa da marca aparece em volta dele.
    const largura = 820;
    const altura = (img.height / img.width) * largura;
    g.drawImage(img, (LARGURA - largura) / 2, 30, largura, altura);
  });
};

/** Dale em Navegantes: o selo da marca à esquerda e o convite à direita. */
const daleNavegantes: Pintor = (g, textura) => {
  fundoDale(g);
  g.fillStyle = CREME_DALE;
  g.textBaseline = 'middle';
  g.font = '600 46px Georgia, serif';
  g.fillText('Conheça a', 470, 150);
  g.font = 'bold 110px Georgia, serif';
  g.fillText('DALE', 470, 250);
  g.font = '600 34px Georgia, serif';
  g.fillText('Congelados Saudáveis', 470, 335);
  g.font = 'bold 38px Arial, sans-serif';
  g.fillText('📍 Navegantes · SC', 470, 410);
  desenharImagem(`${PASTA}Conheça_Dale_congelados_em_Navegantes1.jfif`, textura, (img) => {
    g.drawImage(img, 40, 56, 400, 400);
  });
};

/** "Vem aí a Moda Verão 2027": texto à esquerda, a foto à direita. */
const modaVerao: Pintor = (g, textura) => {
  const fundo = g.createLinearGradient(0, 0, LARGURA, ALTURA);
  fundo.addColorStop(0, '#ff7e5f');
  fundo.addColorStop(1, '#feb47b');
  g.fillStyle = fundo;
  g.fillRect(0, 0, LARGURA, ALTURA);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.font = 'italic 600 52px Georgia, serif';
  g.fillText('Vem aí a', 50, 120);
  g.font = '900 96px Arial Black, Arial, sans-serif';
  g.fillText('MODA', 50, 220);
  g.fillText('VERÃO', 50, 320);
  g.font = '900 80px Arial Black, Arial, sans-serif';
  g.fillStyle = '#ffe066';
  g.fillText('2027', 50, 420);
  // A foto é pessoal e não vai para o GitHub: se o arquivo não existir,
  // desenharImagem não faz nada e o outdoor fica só com o texto.
  desenharImagem(`${PASTA}outdoor_Moda_Verão_ 2027.jpg`, textura, (img) => {
    // Recorta a foto para caber na metade direita, sem esticar.
    const x = 520;
    const larguraArea = LARGURA - x - 30;
    const alturaArea = ALTURA - 60;
    const escala = Math.max(larguraArea / img.width, alturaArea / img.height);
    const recorteL = larguraArea / escala;
    const recorteA = alturaArea / escala;
    g.fillStyle = '#fff';
    g.fillRect(x - 8, 22, larguraArea + 16, alturaArea + 16);
    g.drawImage(img, (img.width - recorteL) / 2, (img.height - recorteA) * 0.3, recorteL, recorteA, x, 30, larguraArea, alturaArea);
  });
};

const ARTES: Record<ArteOutdoor, Pintor> = { bugs, devAds, dale, daleNavegantes, modaVerao };

// --- ajudantes -----------------------------------------------------------------

function fundoDale(g: CanvasRenderingContext2D): void {
  g.fillStyle = ROSA_DALE;
  g.fillRect(0, 0, LARGURA, ALTURA);
  g.strokeStyle = CREME_DALE;
  g.lineWidth = 8;
  g.strokeRect(18, 18, LARGURA - 36, ALTURA - 36);
}

/** Faixa de listras pretas inclinadas (como fita de obra). */
function listrasDeObra(g: CanvasRenderingContext2D, y: number, altura: number): void {
  g.save();
  g.beginPath();
  g.rect(0, y, LARGURA, altura);
  g.clip();
  g.fillStyle = '#111';
  for (let x = -altura; x < LARGURA + altura; x += 60) {
    g.beginPath();
    g.moveTo(x, y + altura);
    g.lineTo(x + 30, y + altura);
    g.lineTo(x + 30 + altura, y);
    g.lineTo(x + altura, y);
    g.fill();
  }
  g.restore();
}

/**
 * Carrega uma imagem e chama `desenhar` quando ela chegar. Se o arquivo não
 * existir, só avisa no console: o outdoor continua com o resto da arte.
 * Imagens enormes (fotos de celular) são reduzidas para no máximo 1024 px
 * de altura antes de desenhar: menos memória e menos trabalho.
 */
function desenharImagem(caminho: string, textura: CanvasTexture, desenhar: (img: CanvasImageSource & { width: number; height: number }) => void): void {
  const img = new Image();
  img.onload = () => {
    desenhar(reduzir(img, 1024));
    textura.needsUpdate = true;
  };
  img.onerror = () => console.info(`Outdoor: imagem "${caminho}" não encontrada; ficou só o texto.`);
  img.src = caminho;
}

function reduzir(img: HTMLImageElement, alturaMaxima: number): HTMLImageElement | HTMLCanvasElement {
  if (img.height <= alturaMaxima) return img;
  const c = document.createElement('canvas');
  c.height = alturaMaxima;
  c.width = Math.round((img.width / img.height) * alturaMaxima);
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
