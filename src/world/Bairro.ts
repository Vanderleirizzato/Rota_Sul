import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Scene,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { texturaAsfalto, texturaDetalheChao } from '../graphics/Texturas';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { obterModelo } from './CarregadorModelos';
import { criarLampadas } from './Fileiras';
import { criarArvoreLeve, criarInstancias, type LugarInstancia } from './Instancias';
import type { CarroDisponivel } from './Cenario';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { DadosBairro, DadosPatio } from './levels/TiposFase';
import { criarSorteio } from './Ruido';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// BAIRROS: ruas em grade, quadras com casas, praças e carros estacionados.
// =============================================================================
// Tudo é medido em DUAS coordenadas a partir da estrada principal:
//   s = distância ao longo da estrada (a mesma das outras coisas da fase);
//   a = metros para longe da beira da estrada.
// Assim o bairro "acompanha" a estrada sem precisar de coordenadas x/z nos
// dados, e mudar o traçado não deixa a cidade para trás.
//
// O chão do bairro é um PÁTIO (ver Patios.ts): o terreno fica plano ali e o
// carro anda livre, sem a grama frear. Por cima dele desenhamos as ruas
// (asfalto) e os lotes (grama). A calçada é o próprio cinza do pátio que
// sobra entre os dois.
//
// Desempenho: as construções, os carros, os postes e as árvores repetem
// poucos modelos muitas vezes, então viram InstancedMesh (uma chamada de
// desenho para todas as cópias), e todas as ruas viram UMA malha só.
// =============================================================================

/** Faixa (m) entre a beira da estrada e a primeira fileira de quadras. */
const CALCADA_DA_ESTRADA = 4;
/** Calçada (m) em volta de cada quadra: o lote de grama começa depois dela. */
const CALCADA_DA_QUADRA = 2.5;
/** Recuo (m) da frente das casas até a beira da quadra (o "jardim da frente"). */
const RECUO_FRENTE = 4;
/** Vão (m) sorteado entre uma construção e a próxima. */
const VAO_ENTRE_CASAS: [number, number] = [2, 6];
/** Uma vaga de estacionamento a cada tantos metros do meio-fio. */
const ESPACO_VAGA = 7;
/** Sem carros perto da esquina (m): senão eles tampam o cruzamento. */
const LONGE_DA_ESQUINA = 7;
/** Do centro do carro estacionado até a beira da rua (m). */
const DO_MEIO_FIO = 1.4;
/** Ruas e lotes ficam este tanto (m) acima do chão: evita o "pisca-pisca" de duas superfícies no mesmo lugar. */
const ACIMA_DO_CHAO = 0.04;
/** As ruas são cortadas em pedaços deste tamanho (m) para acompanhar o chão. */
const PEDACO = 4;
/** A textura de asfalto se repete a cada tantos metros. */
const REPETICAO_ASFALTO = 6;
/** Ao longo de quantos metros o chão do bairro volta a ser morro (ver DadosPatio.suavizar). */
const SUAVIZAR_BORDA_BAIRRO = 50;
const ARVORES_POR_PRACA = 8;
/** Altura das árvores das praças (m): sorteada entre os dois. */
const ALTURA_ARVORE: [number, number] = [5, 9];
const COR_LOTE = 0x5f7d3c;
const COR_COPA = 0x3f7a32;
const COR_TRONCO = 0x6b4a2b;
/** Nenhum carro sorteado estaciona a menos disto (m) de uma vaga reservada (os carros do jogador). */
const LONGE_DAS_RESERVADAS = 7;
const SUMIR = new Matrix4().makeScale(0, 0, 0);

/** Um carro estacionado num bairro: dá para pegar e dirigir (se o modelo tiver rodas). */
interface Estacionado {
  modelo: IdModelo;
  posicao: Vector3;
  angulo: number;
  colisor: RAPIER.Collider;
  /** Qual cópia (na lista de matrizes do modelo) é ele: para escondê-lo quando for pego. */
  copia: number;
  lugares: LugarInstancia[];
  pego: boolean;
}

/**
 * Os carros estacionados de todos os bairros. Eles são cópias de um
 * InstancedMesh (baratos de desenhar), com um colisor fixo. Quando o jogador
 * pega um, a cópia some, o colisor sai, e o Jogo põe um carro de verdade
 * (com rodas e suspensão) exatamente no lugar.
 */
export class CarrosDoBairro {
  constructor(
    private readonly fisica: MundoFisico,
    private readonly lista: Estacionado[],
  ) {}

  disponivel(p: Vector3, raio: number): CarroDisponivel | null {
    let melhor: Estacionado | null = null;
    let menor = raio;
    for (const e of this.lista) {
      const info: InfoModelo = MODELOS[e.modelo];
      if (e.pego || !info.rodas) continue;
      // Do meio do carro até a lataria: uns 2 m.
      const d = Math.max(0, e.posicao.distanceTo(p) - 2);
      if (d <= menor) {
        menor = d;
        melhor = e;
      }
    }
    if (!melhor) return null;
    const e = melhor;
    return { modelo: e.modelo, posicao: e.posicao.clone(), angulo: e.angulo, distancia: menor, pegar: () => this.pegar(e) };
  }

  private pegar(e: Estacionado): void {
    if (e.pego) return;
    e.pego = true;
    this.fisica.removerColisor(e.colisor);
    for (const { malha, indice } of e.lugares) {
      malha.setMatrixAt(indice, SUMIR);
      malha.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Distância entre duas ruas iguais (uma quadra + uma rua). */
function passo(b: DadosBairro): number {
  return b.quadra + b.rua;
}

/** Quantas quadras cabem ao longo da estrada. */
function quadrasAoLongo(b: DadosBairro): number {
  return Math.max(1, Math.floor((b.fim - b.inicio - b.rua) / passo(b)));
}

/** Quanto o bairro avança para longe da beira da estrada (m). */
export function larguraBairro(b: DadosBairro): number {
  return CALCADA_DA_ESTRADA + b.fileirasDeQuadras * passo(b);
}

/** O pátio (chão plano e livre) que o bairro ocupa. */
export function patioDoBairro(b: DadosBairro): DadosPatio {
  return {
    inicio: b.inicio,
    fim: b.inicio + b.rua + quadrasAoLongo(b) * passo(b),
    lado: b.lado,
    // Um pouco mais largo, para a última rua não ficar na rampa da borda do pátio.
    largura: larguraBairro(b) + 6,
    // Barranco bem suave em volta: no meio dos morros de Foz, uma borda curta
    // vira um paredão cinza em volta da cidade.
    suavizar: SUAVIZAR_BORDA_BAIRRO,
  };
}

/** Converte (s, a) do bairro em posição no mundo, com a altura do chão. */
class Grade {
  private readonly sinal: number;

  constructor(
    private readonly tracado: Tracado,
    private readonly terreno: Terreno,
    b: DadosBairro,
  ) {
    this.sinal = b.lado === 'esquerda' ? 1 : -1;
  }

  /** Ponto no chão a `s` m ao longo da estrada e `a` m para longe da beira dela. */
  ponto(s: number, a: number, acima = 0): Vector3 {
    const p = this.tracado.posicaoEm(s, this.sinal * (this.tracado.meiaLarguraTotal + a));
    p.y = this.terreno.alturaEm(p.x, p.z) + acima;
    return p;
  }

  /** Direção (horizontal) que aponta para longe da estrada. */
  paraLonge(s: number): Vector3 {
    return this.tracado.esquerdas[this.tracado.indiceEm(s)].clone().setY(0).normalize().multiplyScalar(this.sinal);
  }

  /** Direção (horizontal) ao longo da estrada, no sentido da corrida. */
  aoLongo(s: number): Vector3 {
    return this.tracado.tangentes[this.tracado.indiceEm(s)].clone().setY(0).normalize();
  }
}

/** Giro em Y que faz a frente de um modelo (+Z) olhar na direção `v`. */
function giroPara(v: Vector3): Quaternion {
  return new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(v.x, v.z));
}

/**
 * Junta retângulos "deitados no chão" numa malha só. Cada retângulo é
 * cortado em pedaços, e cada vértice pega a altura do terreno embaixo dele.
 */
class Retalhos {
  private readonly posicoes: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  constructor(private readonly grade: Grade) {}

  retangulo(s0: number, s1: number, a0: number, a1: number): void {
    const ns = Math.max(1, Math.ceil((s1 - s0) / PEDACO));
    const na = Math.max(1, Math.ceil((a1 - a0) / PEDACO));
    const primeiro = this.posicoes.length / 3;
    for (let i = 0; i <= ns; i++) {
      for (let j = 0; j <= na; j++) {
        const p = this.grade.ponto(s0 + ((s1 - s0) * i) / ns, a0 + ((a1 - a0) * j) / na, ACIMA_DO_CHAO);
        this.posicoes.push(p.x, p.y, p.z);
        // UV pela posição no mundo: onde dois retângulos se cruzam (as
        // esquinas), a textura coincide e a emenda não aparece.
        this.uvs.push(p.x / REPETICAO_ASFALTO, p.z / REPETICAO_ASFALTO);
      }
    }
    for (let i = 0; i < ns; i++) {
      for (let j = 0; j < na; j++) {
        const k = primeiro + i * (na + 1) + j;
        this.triangulo(k, k + na + 1, k + 1);
        this.triangulo(k + na + 1, k + na + 2, k + 1);
      }
    }
  }

  /** Garante que o triângulo fique "de face para cima" (no lado esquerdo e no direito da estrada a ordem se inverte). */
  private triangulo(a: number, b: number, c: number): void {
    const p = this.posicoes;
    const ux = p[b * 3] - p[a * 3], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vz = p[c * 3 + 2] - p[a * 3 + 2];
    // Componente Y do produto vetorial: positiva = virado para cima.
    if (uz * vx - ux * vz >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  malha(material: Material): Mesh | null {
    if (this.indices.length === 0) return null;
    const geometria = new BufferGeometry();
    geometria.setAttribute('position', new Float32BufferAttribute(this.posicoes, 3));
    geometria.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    geometria.setIndex(this.indices);
    geometria.computeVertexNormals();
    const malha = new Mesh(geometria, material);
    malha.receiveShadow = true;
    return malha;
  }
}

/** Monta todos os bairros da fase. */
export async function colocarBairros(
  cena: Scene,
  fisica: MundoFisico,
  tracado: Tracado,
  terreno: Terreno,
  bairros: readonly DadosBairro[],
  /** Vagas que ficam livres (onde estão os carros do jogador). */
  reservadas: readonly Vector3[] = [],
): Promise<CarrosDoBairro> {
  const estacionados: Estacionado[] = [];
  if (bairros.length === 0) return new CarrosDoBairro(fisica, estacionados);
  const ids = [...new Set<IdModelo>([...bairros.flatMap((b) => [...b.construcoes.flat(), ...b.modelosCarros]), 'posteLampiao'])];
  const modelos = new Map(await Promise.all(ids.map(async (id) => [id, await obterModelo(id)] as const)));
  const medidas = new Map(ids.map((id) => [id, new Box3().setFromObject(modelos.get(id)!).getSize(new Vector3())]));

  const matrizes = new Map<IdModelo, Matrix4[]>(ids.map((id) => [id, []]));
  const arvores: Matrix4[] = [];
  const lampadas: Vector3[] = [];
  const materialRua = new MeshStandardMaterial({ map: texturaAsfalto(), roughness: 0.9, metalness: 0 });
  const materialLote = new MeshStandardMaterial({ color: COR_LOTE, map: texturaDetalheChao(), roughness: 1, metalness: 0 });

  bairros.forEach((b, n) => {
    const grade = new Grade(tracado, terreno, b);
    // Semente fixa por bairro: a cidade é sempre a mesma.
    const sorteio = criarSorteio(777 + n * 31);
    const ruas = new Retalhos(grade);
    const lotes = new Retalhos(grade);
    const k = quadrasAoLongo(b);
    const largura = larguraBairro(b);
    const p = passo(b);

    /** Coloca uma cópia de um modelo, com colisor de caixa. */
    const colocar = (id: IdModelo, s: number, a: number, frente: Vector3, escala = 1): RAPIER.Collider => {
      const base = grade.ponto(s, a);
      const giro = giroPara(frente);
      matrizes.get(id)!.push(new Matrix4().compose(base, giro, new Vector3(escala, escala, escala)));
      const t = medidas.get(id)!.clone().multiplyScalar(escala);
      return fisica.criarCaixaFixa({ x: base.x, y: base.y + t.y / 2, z: base.z }, t.x / 2, t.y / 2, t.z / 2, giro);
    };

    // --- ruas -----------------------------------------------------------------
    // Transversais: saem da estrada e vão até o fim do bairro.
    const centroTransversal = (i: number): number => b.inicio + b.rua / 2 + i * p;
    for (let i = 0; i <= k; i++) {
      const s = centroTransversal(i);
      ruas.retangulo(s - b.rua / 2, s + b.rua / 2, 0, largura);
    }
    // Paralelas: uma depois de cada fileira de quadras (a última fecha o bairro).
    const centroParalela = (m: number): number => CALCADA_DA_ESTRADA + m * p + b.quadra + b.rua / 2;
    for (let m = 0; m < b.fileirasDeQuadras; m++) {
      const a = centroParalela(m);
      ruas.retangulo(b.inicio, b.inicio + b.rua + k * p, a - b.rua / 2, a + b.rua / 2);
    }

    // --- quadras ----------------------------------------------------------------
    for (let i = 0; i < k; i++) {
      const s0 = centroTransversal(i) + b.rua / 2;
      const s1 = s0 + b.quadra;
      for (let m = 0; m < b.fileirasDeQuadras; m++) {
        const a0 = CALCADA_DA_ESTRADA + m * p;
        const a1 = a0 + b.quadra;
        const c = CALCADA_DA_QUADRA;
        lotes.retangulo(s0 + c, s1 - c, a0 + c, a1 - c);

        if (sorteio() < (b.pracas ?? 0)) {
          plantarPraca(s0 + c, s1 - c, a0 + c, a1 - c);
        } else {
          const lista = b.construcoes[Math.min(m, b.construcoes.length - 1)];
          const longe = grade.paraLonge((s0 + s1) / 2);
          // Duas fileiras de casas: a da frente olha para a estrada (ou para a
          // rua de trás da quadra anterior) e a de trás olha para a rua de trás.
          fileiraDeCasas(lista, s0, s1, a0 + RECUO_FRENTE, 1, longe.clone().negate());
          fileiraDeCasas(lista, s0, s1, a1 - RECUO_FRENTE, -1, longe);
        }

        // Postes nas quatro esquinas, na calçada.
        for (const [s, a] of [[s0 + 1, a0 + 1], [s1 - 1, a0 + 1], [s0 + 1, a1 - 1], [s1 - 1, a1 - 1]]) {
          const base = grade.ponto(s, a);
          matrizes.get('posteLampiao')!.push(new Matrix4().makeTranslation(base.x, base.y, base.z));
          const altura = medidas.get('posteLampiao')!.y;
          fisica.criarCilindroFixo({ x: base.x, y: base.y + altura / 2, z: base.z }, 0.12, altura / 2);
          const lampada = MODELOS.posteLampiao.lampada;
          if (b.postesAcesos && lampada) lampadas.push(new Vector3(...lampada).add(base));
        }
      }
    }

    // --- carros estacionados ---------------------------------------------------
    const chance = b.carrosEstacionados ?? 0;
    const meioFio = b.rua / 2 - DO_MEIO_FIO;
    const estacionar = (s: number, a: number, frente: Vector3): void => {
      if (sorteio() >= chance) return;
      const id = b.modelosCarros[Math.floor(sorteio() * b.modelosCarros.length)];
      const posicao = grade.ponto(s, a);
      if (reservadas.some((r) => Math.hypot(r.x - posicao.x, r.z - posicao.z) < LONGE_DAS_RESERVADAS)) return;
      const colisor = colocar(id, s, a, frente);
      estacionados.push({ modelo: id, posicao, angulo: Math.atan2(frente.x, frente.z), colisor, copia: matrizes.get(id)!.length - 1, lugares: [], pego: false });
    };
    for (let i = 0; i <= k; i++) {
      // Nas transversais: dos dois lados, ao longo de cada quadra.
      for (const lado of [1, -1]) {
        const s = centroTransversal(i) + lado * meioFio;
        const frente = grade.paraLonge(s).multiplyScalar(lado);
        for (let m = 0; m < b.fileirasDeQuadras; m++) {
          const a0 = CALCADA_DA_ESTRADA + m * p;
          for (let a = a0 + LONGE_DA_ESQUINA; a <= a0 + b.quadra - LONGE_DA_ESQUINA; a += ESPACO_VAGA) estacionar(s, a, frente);
        }
      }
    }
    for (let m = 0; m < b.fileirasDeQuadras; m++) {
      // Nas paralelas: dos dois lados, ao longo de cada quadra.
      for (const lado of [1, -1]) {
        const a = centroParalela(m) + lado * meioFio;
        for (let i = 0; i < k; i++) {
          const s0 = centroTransversal(i) + b.rua / 2;
          for (let s = s0 + LONGE_DA_ESQUINA; s <= s0 + b.quadra - LONGE_DA_ESQUINA; s += ESPACO_VAGA) {
            estacionar(s, a, grade.aoLongo(s).multiplyScalar(-lado));
          }
        }
      }
    }

    for (const r of [ruas.malha(materialRua), lotes.malha(materialLote)]) if (r) cena.add(r);

    /**
     * Uma fileira de construções ao longo da quadra, de s0 a s1. `frenteA` é
     * onde fica a fachada; `paraDentro` (+1 ou -1) diz para que lado do `a`
     * a construção cresce; `frente` é para onde a fachada olha.
     */
    function fileiraDeCasas(lista: IdModelo[], s0: number, s1: number, frenteA: number, paraDentro: number, frente: Vector3): void {
      // Cada fileira ocupa no máximo meia quadra de fundo (a outra metade é da fileira de trás).
      const fundoMaximo = b.quadra / 2 - RECUO_FRENTE - 1;
      let s = s0 + CALCADA_DA_QUADRA + 1;
      for (;;) {
        const id = lista[Math.floor(sorteio() * lista.length)];
        const tamanho = medidas.get(id)!;
        // Prédio fundo demais para o lote: diminui o prédio inteiro.
        const escala = Math.min(1, fundoMaximo / tamanho.z, (s1 - s0 - 2 * CALCADA_DA_QUADRA - 2) / tamanho.x);
        const largura = tamanho.x * escala;
        if (s + largura > s1 - CALCADA_DA_QUADRA - 1) return;
        colocar(id, s + largura / 2, frenteA + paraDentro * (tamanho.z * escala) / 2, frente, escala);
        s += largura + VAO_ENTRE_CASAS[0] + sorteio() * (VAO_ENTRE_CASAS[1] - VAO_ENTRE_CASAS[0]);
      }
    }

    /** Praça: árvores sorteadas pelo lote, cada uma com um tronco sólido. */
    function plantarPraca(s0: number, s1: number, a0: number, a1: number): void {
      for (let j = 0; j < ARVORES_POR_PRACA; j++) {
        const base = grade.ponto(s0 + 2 + sorteio() * (s1 - s0 - 4), a0 + 2 + sorteio() * (a1 - a0 - 4));
        const altura = ALTURA_ARVORE[0] + sorteio() * (ALTURA_ARVORE[1] - ALTURA_ARVORE[0]);
        arvores.push(new Matrix4().compose(base, giroPara(new Vector3(sorteio() - 0.5, 0, sorteio() - 0.5)), new Vector3(altura, altura, altura)));
        fisica.criarCilindroFixo({ x: base.x, y: base.y + altura / 4, z: base.z }, 0.25, altura / 4);
      }
    }
  });

  for (const [id, lista] of matrizes) {
    const onde: LugarInstancia[][] = [];
    criarInstancias(cena, modelos.get(id)!, lista, true, onde);
    for (const e of estacionados) if (e.modelo === id) e.lugares = onde[e.copia];
  }
  criarInstancias(cena, criarArvoreLeve(COR_COPA, COR_TRONCO), arvores);
  if (lampadas.length > 0) cena.add(criarLampadas(lampadas));
  return new CarrosDoBairro(fisica, estacionados);
}
