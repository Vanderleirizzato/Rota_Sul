import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene,
  type Vector3,
} from 'three';
import { CAMADA_BRILHO } from './Camadas';

// =============================================================================
// MARCADOR DE MISSÃO: a coluna de luz que marca onde começa a corrida.
// =============================================================================
// No passeio, o jogador precisa ACHAR a corrida. Uma coluna alta e brilhante
// se vê de longe, por cima das árvores; o anel no chão mostra até onde
// é preciso chegar para o convite aparecer.
//
// Por que "AdditiveBlending" (mistura aditiva)? A cor da coluna SOMA com o que
// está atrás, como luz de verdade: fica transparente onde é fraca e nunca
// escurece o cenário. Ela também entra na camada do bloom, que espalha o brilho.
// =============================================================================

/** Altura da coluna de luz (m): mais alta que as árvores, para ver de longe. */
const ALTURA = 40;
/** Cor padrão do marcador (corrida): o amarelo do HUD e do título do jogo. */
export const COR_CORRIDA = 0xffcc33;
/** Cor do marcador de viagem (seguir para a próxima fase): o azul do nitro. */
export const COR_VIAGEM = 0x33e1ff;
/** Opacidade da coluna com o carro dentro dela (1 = normal; 0 = some, fica só o anel no chão). */
const OPACIDADE_DENTRO = 0;

export class MarcadorMissao {
  private readonly grupo = new Group();
  private readonly anel: Mesh;
  private readonly materialColuna: MeshBasicMaterial;
  private tempo = 0;

  /** `raio`: o tamanho do anel no chão, o mesmo raio que ativa o convite (tuning.corrida.raioMarcador). */
  constructor(cena: Scene, posicao: Vector3, raio: number, cor = COR_CORRIDA) {
    // A coluna: um cilindro aberto, com um degradê que some para cima.
    this.materialColuna = new MeshBasicMaterial({
      color: cor,
      map: degradeVertical(),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false, // não "tampa" o que está atrás (é luz, não parede)
      side: DoubleSide,
      fog: false, // a neblina apagaria a coluna justamente de longe
    });
    const coluna = new Mesh(
      new CylinderGeometry(raio * 0.35, raio * 0.35, ALTURA, 24, 1, true).translate(0, ALTURA / 2, 0),
      this.materialColuna,
    );
    this.anel = new Mesh(
      new RingGeometry(raio - 0.5, raio, 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    );
    this.anel.position.y = 0.15; // logo acima do asfalto, sem "brigar" com ele
    for (const malha of [coluna, this.anel]) {
      malha.layers.enable(CAMADA_BRILHO);
      // A luz não faz sombra nem recebe.
      malha.castShadow = false;
      malha.receiveShadow = false;
    }
    this.grupo.add(coluna, this.anel);
    this.grupo.position.copy(posicao);
    cena.add(this.grupo);
  }

  /** Só aparece no passeio (durante a corrida, ele atrapalharia a largada). */
  mostrar(visivel: boolean): void {
    this.grupo.visible = visivel;
  }

  /**
   * O anel "respira" devagar: algo que pulsa chama a atenção.
   * `dentro`: o carro está no marcador. Aí a coluna quase some, senão vira
   * uma parede amarela entre a câmera e o carro.
   */
  atualizar(dt: number, dentro: boolean): void {
    this.tempo += dt;
    const alvo = dentro ? OPACIDADE_DENTRO : 1;
    this.materialColuna.opacity += (alvo - this.materialColuna.opacity) * Math.min(dt * 4, 1);
    const pulso = 1 + 0.06 * Math.sin(this.tempo * 3);
    this.anel.scale.set(pulso, 1, pulso);
  }
}

/** Textura 1×64: forte embaixo, sumindo em direção ao topo. */
function degradeVertical(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  if (g) {
    // No canvas o y cresce para baixo; na textura, o topo do canvas é o topo da coluna.
    const degrade = g.createLinearGradient(0, 0, 0, 64);
    degrade.addColorStop(0, 'rgba(255,255,255,0)');
    degrade.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    degrade.addColorStop(1, 'rgba(255,255,255,0.75)');
    g.fillStyle = degrade;
    g.fillRect(0, 0, 1, 64);
  }
  return new CanvasTexture(canvas);
}
