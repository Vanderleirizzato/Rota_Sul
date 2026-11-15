import { CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, PointLight, TorusGeometry, Vector2, Vector3, type Scene } from 'three';
import { CAMADA_BRILHO } from '../graphics/Camadas';
import { FogosArtificio } from '../graphics/FogosArtificio';
import type { EstadoCarro } from './Cenario';
import type { TrofeuFase } from './levels/TiposFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// TROFÉU ESCONDIDO (libera o Modo Dev)
// =============================================================================
// Uma taça dourada flutuando e girando. A forma é feita por "torno"
// (LatheGeometry): desenhamos meio perfil da taça (pontos de raio × altura)
// e o three.js gira esse perfil em volta do eixo, como um oleiro faz um vaso.
//
// Encostou nele: fogos de artifício no céu e o aviso ao Jogo (pegou()), que
// mostra a mensagem e libera o painel de tuning.
// =============================================================================

/** Altura (m) em que a taça flutua acima do chão. */
const ALTURA = 1.6;
/** Distância (m) do carro para contar como "encostou". */
const ALCANCE = 3;

export class Trofeu {
  private readonly grupo = new Group();
  private readonly fogos: FogosArtificio;
  private readonly centro: Vector3;
  private tempo = 0;
  private pego = false;
  private avisar = false;

  constructor(cena: Scene, tracado: Tracado, terreno: Terreno, dados: TrofeuFase) {
    this.fogos = new FogosArtificio(cena);
    const p = tracado.pontoAoLado(dados.distancia, dados.lado, dados.afastamento);
    p.y = terreno.alturaEm(p.x, p.z);
    this.centro = p;

    // Ouro: bem metálico e liso. O "emissive" faz ele brilhar sozinho, e a
    // camada de brilho (bloom) espalha esse brilho em volta.
    const ouro = new MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.18, emissive: 0xffa000, emissiveIntensity: 0.6 });
    // Meio perfil da taça, de baixo para cima: [raio, altura].
    const perfil = [
      [0.0, 0.0], [0.42, 0.0], [0.42, 0.08], [0.16, 0.14], [0.1, 0.3], [0.08, 0.55],
      [0.16, 0.65], [0.42, 0.78], [0.52, 1.05], [0.54, 1.3], [0.5, 1.3], [0.47, 1.06], [0.38, 0.82], [0.0, 0.72],
    ].map(([r, y]) => new Vector2(r, y));
    const taca = new Mesh(new LatheGeometry(perfil, 40), ouro);
    // As alças: dois anéis de lado.
    for (const lado of [-1, 1]) {
      const alca = new Mesh(new TorusGeometry(0.2, 0.04, 10, 24), ouro);
      alca.position.set(lado * 0.56, 1.0, 0);
      alca.rotation.y = Math.PI / 2;
      this.grupo.add(alca);
    }
    const base = new Mesh(new CylinderGeometry(0.5, 0.55, 0.18, 32), new MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
    base.position.y = -0.09;
    this.grupo.add(taca, base);
    this.grupo.traverse((o) => {
      o.castShadow = true;
      o.layers.enable(CAMADA_BRILHO);
    });
    // Uma luz dourada: ilumina os contêineres em volta e ajuda a achar o troféu.
    const luz = new PointLight(0xffc83d, 30, 18, 1.6);
    luz.position.y = 1.2;
    this.grupo.add(luz);
    this.grupo.position.copy(p).setY(p.y + ALTURA);
    cena.add(this.grupo);
  }

  atualizar(dt: number, carro: EstadoCarro): void {
    this.tempo += dt;
    this.fogos.atualizar(dt);
    if (this.pego) return;
    // Flutua (sobe e desce devagar) e gira.
    this.grupo.rotation.y += dt * 1.5;
    this.grupo.position.y = this.centro.y + ALTURA + Math.sin(this.tempo * 2) * 0.25;
    if (carro.posicao.distanceTo(this.grupo.position) < ALCANCE) {
      this.pego = true;
      this.avisar = true;
      this.grupo.visible = false;
      this.fogos.disparar(this.centro);
    }
  }

  /** True uma única vez, logo depois de o carro encostar no troféu. */
  pegou(): boolean {
    const valor = this.avisar;
    this.avisar = false;
    return valor;
  }

  /** Corrida reiniciada: o troféu volta (para mostrar os fogos de novo a quem quiser). */
  reiniciar(): void {
    this.pego = false;
    this.grupo.visible = true;
  }
}
