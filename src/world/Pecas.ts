import { BoxGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, type Scene } from 'three';
import { CAMADA_BRILHO } from '../graphics/Camadas';
import { tuning } from '../config/tuning';
import { guardarPeca, idPeca, pecaColetada, pecasDaFase } from '../core/Progresso';
import type { EstadoCarro } from './Cenario';
import type { PecaFase, TipoPeca } from './levels/TiposFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// PEÇAS DE TUNING: engrenagens brilhantes espalhadas pelo mapa.
// =============================================================================
// Cada peça pega dá um bônus pequeno e PERMANENTE ao carro (ver
// tuning.pecas e Progresso.ts). Assim explorar o mapa ajuda a bater o
// tempo-meta que libera a próxima fase.
//
// Peça já pega não aparece de novo: o progresso fica salvo no navegador.
// =============================================================================

/** Altura (m) em que a peça flutua acima do chão: na altura do capô, fácil de acertar. */
const ALTURA = 1.3;
/** Cor de cada tipo: o jogador aprende a reconhecer de longe. */
const CORES: Record<TipoPeca, number> = { turbo: 0xff7a1a, pneus: 0x33e1ff, nitro: 0xb04dff };
/** Nome e efeito de cada tipo, para a mensagem na tela. */
export const DESCRICAO_PECA: Record<TipoPeca, { nome: string; efeito: string }> = {
  turbo: { nome: 'Turbo', efeito: 'mais força no motor' },
  pneus: { nome: 'Pneus esportivos', efeito: 'mais aderência nas curvas' },
  nitro: { nome: 'Cilindro de nitro', efeito: 'nitro dura mais' },
};

/** O que o Jogo recebe quando uma peça é pega. */
export interface PecaPega {
  tipo: TipoPeca;
  /** Quantas desta fase já foram pegas (contando esta) e quantas existem. */
  coletadas: number;
  total: number;
}

interface PecaNoMundo {
  id: string;
  tipo: TipoPeca;
  objeto: Group;
  /** Altura de repouso (a peça sobe e desce em volta dela). */
  base: number;
  /** Cada peça começa a flutuar num ponto diferente da onda: não sobem todas juntas. */
  fase: number;
}

export class Pecas {
  private readonly pecas: PecaNoMundo[] = [];
  private readonly pegas: PecaPega[] = [];
  private tempo = 0;

  constructor(
    private readonly cena: Scene,
    tracado: Tracado,
    terreno: Terreno,
    private readonly idFase: string,
    private readonly lista: PecaFase[],
  ) {
    lista.forEach((dados, indice) => {
      const id = idPeca(idFase, indice, dados.tipo);
      if (pecaColetada(id)) return;
      const p = tracado.pontoAoLado(dados.distancia, dados.lado, dados.afastamento);
      // Na pista, vale a altura do asfalto; fora dela, a do chão (que pode ser um morro).
      const chao = Math.max(p.y, terreno.alturaEm(p.x, p.z));
      const objeto = criarEngrenagem(CORES[dados.tipo]);
      objeto.position.set(p.x, chao + ALTURA, p.z);
      cena.add(objeto);
      this.pecas.push({ id, tipo: dados.tipo, objeto, base: chao + ALTURA, fase: indice * 1.7 });
    });
  }

  /** Gira e flutua; o carro encostou numa peça? Guarda e avisa. */
  atualizar(dt: number, carro: EstadoCarro): void {
    this.tempo += dt;
    const raio = tuning.pecas.raioColeta;
    for (let i = this.pecas.length - 1; i >= 0; i--) {
      const peca = this.pecas[i];
      peca.objeto.rotation.y += dt * 2;
      peca.objeto.position.y = peca.base + Math.sin(this.tempo * 2 + peca.fase) * 0.25;
      if (peca.objeto.position.distanceTo(carro.posicao) > raio) continue;
      this.cena.remove(peca.objeto);
      this.pecas.splice(i, 1);
      guardarPeca(peca.id);
      this.pegas.push({ tipo: peca.tipo, coletadas: pecasDaFase(this.idFase), total: this.lista.length });
    }
  }

  /** A peça pega desde a última consulta (uma por vez), ou null. */
  colher(): PecaPega | null {
    return this.pegas.shift() ?? null;
  }

  get total(): number {
    return this.lista.length;
  }
}

/** Uma engrenagem: um anel com 8 dentes, brilhando (entra no bloom). */
function criarEngrenagem(cor: number): Group {
  const material = new MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 });
  const grupo = new Group();
  grupo.add(new Mesh(new TorusGeometry(0.45, 0.16, 10, 24), material));
  const dente = new BoxGeometry(0.22, 0.22, 0.2);
  for (let k = 0; k < 8; k++) {
    const angulo = (k / 8) * Math.PI * 2;
    const d = new Mesh(dente, material);
    d.position.set(Math.cos(angulo) * 0.66, Math.sin(angulo) * 0.66, 0);
    d.rotation.z = angulo;
    grupo.add(d);
  }
  grupo.traverse((o) => {
    o.layers.enable(CAMADA_BRILHO);
    o.castShadow = true;
  });
  return grupo;
}
