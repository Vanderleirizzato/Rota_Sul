import { CanvasTexture, DoubleSide, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, SRGBColorSpace, Vector3 } from 'three';
import type { CarroVisual } from './CarroVisual';

// =============================================================================
// PLACA TRASEIRA "ENZ-ADS" (padrão Mercosul)
// =============================================================================
// A placa é desenhada num <canvas> do navegador, com as mesmas funções de
// desenhar 2D de qualquer página web (retângulos, texto), e o canvas vira a
// textura de um retângulo 3D (CanvasTexture). Assim não precisamos de nenhum
// arquivo de imagem, e trocar o texto da placa é trocar uma string.
//
// Onde fica a placa? Cada carro tem um formato. Em vez de medir à mão,
// "atiramos um raio" por trás do carro, na altura da placa, e ela vai para
// onde o raio encostar na lataria.
// =============================================================================

export const TEXTO_PLACA = 'ENZ-ADS';
/** Tamanho real de uma placa de carro Mercosul: 40 × 13 cm. */
const LARGURA = 0.4;
const ALTURA = 0.13;
/** Afastamento da lataria (m): sem ele a placa "briga" com a tinta e pisca. */
const FOLGA = 0.012;

let textura: CanvasTexture | null = null;

/** Desenha a placa (uma vez só; os três carros usam a mesma textura). */
function texturaPlaca(): CanvasTexture {
  if (textura) return textura;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 208; // mesma proporção de 40 × 13
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível.');
  const w = canvas.width;
  const h = canvas.height;

  // Fundo branco com cantos arredondados e borda preta.
  g.fillStyle = '#f4f4f2';
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 18);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#111';
  g.stroke();

  // Faixa azul de cima, com "BRASIL" no meio.
  const faixa = h * 0.24;
  g.save();
  g.clip();
  g.fillStyle = '#1b3a8f';
  g.fillRect(0, 0, w, faixa);
  g.restore();
  g.fillStyle = '#fff';
  g.font = `bold ${faixa * 0.62}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BRASIL', w / 2, faixa / 2 + 2);

  // Bandeirinha do Brasil à direita da faixa: verde, losango amarelo, círculo azul.
  const bx = w - 78;
  const by = faixa * 0.18;
  const bw = 52;
  const bh = faixa * 0.64;
  g.fillStyle = '#1e9e3a';
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#f7d117';
  g.beginPath();
  g.moveTo(bx + bw / 2, by + 3);
  g.lineTo(bx + bw - 4, by + bh / 2);
  g.lineTo(bx + bw / 2, by + bh - 3);
  g.lineTo(bx + 4, by + bh / 2);
  g.fill();
  g.fillStyle = '#1b3a8f';
  g.beginPath();
  g.arc(bx + bw / 2, by + bh / 2, bh * 0.24, 0, Math.PI * 2);
  g.fill();

  // O texto da placa, em preto, ocupando o resto.
  g.fillStyle = '#111';
  g.font = `bold ${h * 0.58}px "Arial Black", Arial, sans-serif`;
  g.fillText(TEXTO_PLACA, w / 2, faixa + (h - faixa) / 2 + 4);

  textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 4; // a placa é vista de lado, inclinada: fica nítida assim
  return textura;
}

/**
 * Prende a placa na traseira do carro.
 * @param altura altura do centro da placa acima do chão (m), já no tamanho do jogo.
 */
export function colocarPlaca(carro: CarroVisual, altura: number): Mesh {
  const placa = new Mesh(
    new PlaneGeometry(LARGURA, ALTURA),
    new MeshStandardMaterial({ map: texturaPlaca(), roughness: 0.45, metalness: 0.1, side: DoubleSide }),
  );
  placa.name = 'Placa';
  placa.castShadow = false;
  placa.receiveShadow = true;

  // O raio sai de trás do carro e anda para a frente (+Z) até bater na lataria.
  const { centroCaixa, meiasMedidas } = carro.geometria;
  const atras = centroCaixa.z - meiasMedidas.z * 2;
  const rodas = carro.malhasDasRodas();
  const raio = new Raycaster(new Vector3(centroCaixa.x, altura, atras), new Vector3(0, 0, 1));
  carro.objeto.updateMatrixWorld(true);
  const acerto = raio.intersectObject(carro.objeto, true).find((a) => a.object instanceof Mesh && !rodas.has(a.object));
  // Se o raio passou por baixo do para-choque e só encostou lá no meio do
  // carro, a altura está errada: a placa fica na traseira da caixa e avisamos.
  const traseira = centroCaixa.z - meiasMedidas.z;
  const naTraseira = acerto !== undefined && acerto.point.z < traseira + meiasMedidas.z * 0.4;
  if (!naTraseira) console.warn(`Placa: nada da traseira na altura ${altura} m; ajuste alturaPlaca em assets.ts.`);
  const z = naTraseira ? acerto.point.z - FOLGA : traseira;

  // O plano "olha" para +Z; girado meia volta, olha para trás do carro.
  placa.position.set(centroCaixa.x, altura, z);
  placa.rotation.y = Math.PI;
  carro.objeto.add(placa);
  return placa;
}
