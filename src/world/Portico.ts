import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import type { PorticoFase } from './levels/TiposFase';
import type { Tracado } from './Tracado';

// =============================================================================
// PÓRTICO DE ENTRADA DE CIDADE ("BEM-VINDO A ENZOLÂNDIA")
// =============================================================================
// Montado com caixas simples (dois pilares e uma viga), como os pórticos de
// concreto das cidades do interior. A placa é pintada num <canvas>
// (CanvasTexture): trocar o texto é trocar `titulo` e `subtitulo` nos dados da fase.
// =============================================================================

/** Altura livre embaixo da viga (m): passa até caminhão. */
const VAO = 6.5;
const LADO_PILAR = 1.1;
const ALTURA_VIGA = 1.2;
/** Placa: largura e altura (m). */
const PLACA_L = 13;
const PLACA_A = 3.2;

export function colocarPortico(cena: Scene, fisica: MundoFisico, tracado: Tracado, dados: PorticoFase): void {
  const i = tracado.indiceEm(dados.distancia);
  const centro = tracado.pontos[i];
  const angulo = tracado.anguloEm(i);
  // Pilares fora do acostamento, com um metro de folga.
  const meioVao = tracado.pista.largura / 2 + tracado.pista.acostamento + 1 + LADO_PILAR / 2;

  const portico = new Group();
  portico.position.copy(centro);
  portico.rotation.y = angulo;
  const concreto = new MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.85 });
  const faixa = new MeshStandardMaterial({ color: 0x1f6f43, roughness: 0.7 });

  const alturaTotal = VAO + ALTURA_VIGA;
  for (const lado of [-1, 1]) {
    const pilar = new Mesh(new BoxGeometry(LADO_PILAR, alturaTotal + 2, LADO_PILAR), concreto);
    // +2 m enterrados: o pé do pilar não fica flutuando onde o chão desce.
    pilar.position.set(lado * meioVao, (alturaTotal + 2) / 2 - 2, 0);
    portico.add(pilar);
    // Colisor do pilar (no mundo: gira junto com a pista).
    const giro = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angulo);
    const p = new Vector3(lado * meioVao, alturaTotal / 2, 0).applyQuaternion(giro).add(centro);
    fisica.criarCaixaFixa(p, LADO_PILAR / 2, alturaTotal / 2, LADO_PILAR / 2, giro);
  }
  const viga = new Mesh(new BoxGeometry(meioVao * 2 + LADO_PILAR, ALTURA_VIGA, LADO_PILAR), concreto);
  viga.position.y = VAO + ALTURA_VIGA / 2;
  portico.add(viga);
  const listra = new Mesh(new BoxGeometry(meioVao * 2 + LADO_PILAR + 0.02, 0.25, LADO_PILAR + 0.02), faixa);
  listra.position.y = VAO + 0.2;
  portico.add(listra);

  // A placa em cima da viga, dos dois lados (quem vem e quem vai lê certo).
  const material = new MeshStandardMaterial({ map: pintarPlaca(dados), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.25 });
  material.emissiveMap = material.map;
  for (const frente of [-1, 1]) {
    const placa = new Mesh(new PlaneGeometry(PLACA_L, PLACA_A), material);
    placa.position.set(0, VAO + ALTURA_VIGA + PLACA_A / 2 - 0.1, frente * (LADO_PILAR / 2 + 0.02));
    // O plano "olha" para o +Z (o sentido da pista). A placa da face de
    // trás (-Z), que quem está chegando vê, é girada meia volta.
    if (frente === -1) placa.rotation.y = Math.PI;
    portico.add(placa);
  }
  const fundoPlaca = new Mesh(new BoxGeometry(PLACA_L + 0.3, PLACA_A + 0.3, LADO_PILAR * 0.8), faixa);
  fundoPlaca.position.y = VAO + ALTURA_VIGA + PLACA_A / 2 - 0.1;
  portico.add(fundoPlaca);

  portico.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  cena.add(portico);
}

/** Placa verde de estrada, com letras brancas (como as placas de cidade do Brasil). */
function pintarPlaca(dados: PorticoFase): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1300;
  canvas.height = 320;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível.');
  g.fillStyle = '#1f6f43';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 104px Arial Black, Arial, sans-serif';
  g.fillText(dados.titulo, canvas.width / 2, 120, canvas.width - 80);
  g.fillStyle = '#ffd84d';
  g.font = 'bold 58px Arial, sans-serif';
  g.fillText(dados.subtitulo, canvas.width / 2, 240, canvas.width - 80);
  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}
