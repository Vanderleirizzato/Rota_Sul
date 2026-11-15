import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { CAMADA_BRILHO } from '../graphics/Camadas';
import { obterModelo } from './CarregadorModelos';
import type { Tracado } from './Tracado';

// =============================================================================
// BLOQUEIOS NAS PONTAS DA ESTRADA: "PISTA INTERDITADA"
// =============================================================================
// A estrada continua reta até perto da borda do mundo (ver PROLONGAMENTO no
// Tracado.ts) e termina num bloqueio: barreiras de concreto atravessadas
// (barreirasNasPontas, em ObjetosFase.ts), cones fechando a pista aos poucos,
// uma viatura de giroflex ligado e uma placa. Assim o fim da estrada tem um
// motivo, em vez de o asfalto simplesmente acabar.
// =============================================================================

/** Onde fica cada coisa, em metros ANTES da barreira (para dentro da estrada). */
const VIATURA_ANTES = 9;
const PLACA_ANTES = 24;
/** Cones: a fileira diagonal começa aqui e vai até a barreira. */
const CONES_ANTES = 40;
const QUANTOS_CONES = 9;
/** Giroflex: piscadas por segundo (vermelho e azul se revezam). */
const PISCADAS_POR_SEGUNDO = 2.5;

/** Uma ponta da estrada: onde está a barreira e para que lado fica o "dentro" da estrada. */
interface Ponta {
  barreira: Vector3;
  /** Direção (horizontal) que aponta da barreira de volta para a estrada. */
  dentro: Vector3;
  /** Esquerda de quem vem dirigindo em direção ao bloqueio. */
  esquerda: Vector3;
}

export class Bloqueios {
  /** As luzes do giroflex: [vermelha, azul] de cada viatura. */
  private readonly luzes: [Mesh, Mesh][] = [];
  private tempo = 0;

  private constructor() {}

  static async criar(cena: Scene, fisica: MundoFisico, tracado: Tracado): Promise<Bloqueios> {
    const b = new Bloqueios();
    const n = tracado.quantidade - 1;
    const pontas: Ponta[] = [
      // No começo, a estrada "entra" no sentido da tangente; no fim, no sentido contrário.
      { barreira: tracado.pontos[0], dentro: tracado.tangentes[0].clone().setY(0).normalize(), esquerda: new Vector3() },
      { barreira: tracado.pontos[n], dentro: tracado.tangentes[n].clone().setY(0).normalize().negate(), esquerda: new Vector3() },
    ];
    const placa = criarPlaca();
    const [viatura, cone] = await Promise.all([obterModelo('viatura'), obterModelo('cone')]);
    for (const p of pontas) {
      // Quem vem dirigindo anda no sentido contrário de "dentro"; a esquerda dele:
      const indo = p.dentro.clone().negate();
      p.esquerda.set(indo.z, 0, -indo.x);
      b.colocarViatura(cena, fisica, tracado, p, viatura.clone());
      colocarCones(cena, tracado, p, cone);
      colocarPlaca(cena, tracado, p, placa.clone());
    }
    return b;
  }

  /** Pisca o giroflex. */
  atualizar(dt: number): void {
    this.tempo += dt;
    const vermelho = Math.floor(this.tempo * PISCADAS_POR_SEGUNDO * 2) % 2 === 0;
    for (const [v, a] of this.luzes) {
      v.visible = vermelho;
      a.visible = !vermelho;
    }
  }

  /** Viatura atravessada na pista (de lado para quem chega), com colisor e giroflex. */
  private colocarViatura(cena: Scene, fisica: MundoFisico, tracado: Tracado, p: Ponta, viatura: Group): void {
    const pos = p.barreira.clone().addScaledVector(p.dentro, VIATURA_ANTES).addScaledVector(p.esquerda, 1.5);
    pos.y = alturaPista(tracado, pos);
    // Atravessada, meio de viés (uns 70° em relação à estrada), como quem fechou a pista às pressas.
    const angulo = Math.atan2(p.dentro.x, p.dentro.z) + Math.PI / 2 - 0.35;
    // Mede o modelo reto (sem giro): o carregador já o deixou centrado em X/Z
    // e com a base em Y = 0, então o centro do colisor fica meia altura acima.
    const reta = new Box3().setFromObject(viatura).getSize(new Vector3());
    viatura.position.copy(pos);
    viatura.rotation.y = angulo;
    cena.add(viatura);

    const centro = pos.clone().setY(pos.y + reta.y / 2);
    const giro = { x: 0, y: Math.sin(angulo / 2), z: 0, w: Math.cos(angulo / 2) };
    fisica.criarCaixaFixa(centro, reta.x / 2, reta.y / 2, reta.z / 2, giro);

    // Giroflex: duas luzinhas no teto que brilham no bloom.
    const vermelha = luzGiroflex(0xff2020);
    const azul = luzGiroflex(0x2060ff);
    vermelha.position.set(0.3, reta.y + 0.05, 0);
    azul.position.set(-0.3, reta.y + 0.05, 0);
    viatura.add(vermelha, azul);
    this.luzes.push([vermelha, azul]);
  }
}

/** Cones em diagonal: fecham a pista aos poucos, da direita para a esquerda de quem chega. */
function colocarCones(cena: Scene, tracado: Tracado, p: Ponta, cone: Group): void {
  const meia = tracado.pista.largura / 2;
  for (let k = 0; k < QUANTOS_CONES; k++) {
    const f = k / (QUANTOS_CONES - 1);
    const pos = p.barreira
      .clone()
      .addScaledVector(p.dentro, CONES_ANTES * (1 - f) + 2)
      .addScaledVector(p.esquerda, -meia + f * meia * 1.6);
    pos.y = alturaPista(tracado, pos);
    const c = cone.clone();
    c.position.copy(pos);
    cena.add(c);
  }
}

/** A placa fica no acostamento da direita de quem chega, virada para ele. */
function colocarPlaca(cena: Scene, tracado: Tracado, p: Ponta, placa: Group): void {
  const pos = p.barreira
    .clone()
    .addScaledVector(p.dentro, PLACA_ANTES)
    .addScaledVector(p.esquerda, -(tracado.meiaLarguraTotal - 0.5));
  pos.y = alturaPista(tracado, pos);
  placa.position.copy(pos);
  placa.rotation.y = Math.atan2(p.dentro.x, p.dentro.z);
  cena.add(placa);
}

/** Altura do asfalto embaixo de um ponto (o trecho prolongado é reto e plano). */
function alturaPista(tracado: Tracado, pos: Vector3): number {
  const proj = tracado.projetar(pos);
  return tracado.alturaSuperficie(proj.indice, proj.lateral);
}

function luzGiroflex(cor: number): Mesh {
  const luz = new Mesh(new BoxGeometry(0.4, 0.14, 0.22), new MeshBasicMaterial({ color: cor }));
  luz.layers.enable(CAMADA_BRILHO);
  return luz;
}

/** Placa laranja de obra, em dois postes: desenhada num canvas (sem arquivo de imagem). */
function criarPlaca(): Group {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#ff7a00';
    g.fillRect(0, 0, 512, 256);
    // Faixas zebradas em cima e embaixo, como nas placas de obra de verdade.
    for (let x = -64; x < 512; x += 64) {
      g.fillStyle = '#111';
      for (const y of [0, 216]) {
        g.beginPath();
        g.moveTo(x, y + 40);
        g.lineTo(x + 32, y);
        g.lineTo(x + 64, y);
        g.lineTo(x + 32, y + 40);
        g.fill();
      }
    }
    g.fillStyle = '#111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 64px Arial, sans-serif';
    g.fillText('PISTA', 256, 100);
    g.fillText('INTERDITADA', 256, 160);
  }
  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;

  const placa = new Group();
  const largura = 3;
  const altura = 1.5;
  const baixo = 1.2;
  const painel = new Mesh(new PlaneGeometry(largura, altura), new MeshStandardMaterial({ map: textura, roughness: 0.7 }));
  painel.position.y = baixo + altura / 2;
  const fundo = new Mesh(new PlaneGeometry(largura, altura), new MeshStandardMaterial({ color: 0x777777 }));
  fundo.position.y = painel.position.y;
  fundo.rotation.y = Math.PI;
  const materialPoste = new MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.4 });
  for (const x of [-largura / 2 + 0.25, largura / 2 - 0.25]) {
    const poste = new Mesh(new CylinderGeometry(0.05, 0.05, baixo + altura), materialPoste);
    poste.position.set(x, (baixo + altura) / 2, -0.03);
    placa.add(poste);
  }
  placa.add(painel, fundo);
  placa.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = o.receiveShadow = true;
  });
  return placa;
}
