import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Uint32BufferAttribute,
  Vector3,
  type Scene,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { texturaDetalheChao } from '../graphics/Texturas';
import type { ConfigBioma } from './biomas';
import type { DadosRio } from './levels/TiposFase';
import { ruido2D, ruidoMorros, transicao } from './Ruido';
import { distanciaHorizontal, type Tracado } from './Tracado';

// =============================================================================
// TERRENO: o chão em volta da pista, uma grade de alturas.
// =============================================================================
// A altura de cada ponto da grade depende da DISTÂNCIA ATÉ A PISTA:
//   - perto da pista: plano, um pouco abaixo do asfalto (para não "furar" a estrada);
//   - mais longe: sobe em morros (ruído), formando o vale da serra;
//   - bem longe: continua subindo, e viram as montanhas do fundo.
// Como os morros sobem dos dois lados, o próprio relevo segura o carro na
// estrada: ninguém cai para fora do mundo (CLAUDE.md).
//
// O rio cava um leito atravessando a pista, por baixo da ponte.
// =============================================================================

/** Espaço entre os pontos da grade (m). Menor: relevo mais detalhado e mais pesado. */
const ESPACAMENTO = 8;
/** Quanto terreno existe além da pista em cada direção (m). */
const MARGEM = 340;
/** O chão perto da pista fica este tanto abaixo do asfalto (m). */
const ABAIXO_DO_ASFALTO = 0.35;
/** Faixa plana (m) depois da beira do acostamento, antes de começar a subir. */
const FAIXA_PLANA = 4;
/**
 * Logo depois da faixa plana vem um "barranco manso": sobe só uma fração do
 * morro, numa inclinação em que o carro ainda roda (uns 20°). Só depois vem a
 * encosta de verdade. Sem esse degrau, quem saía da pista em velocidade
 * subia de lado numa parede de grama e capotava "do nada".
 */
const LARGURA_BARRANCO = 22;
/** Fração da altura do morro que o barranco manso sobe (0 a 1). */
const FRACAO_BARRANCO = 0.2;
/** Distância (m) em que a encosta vai do barranco até a altura cheia do morro. */
const LARGURA_ENCOSTA = 46;
/** Leito do rio: profundidade abaixo da água e largura da margem inclinada (m). */
const PROFUNDIDADE_RIO = 2.5;
const MARGEM_RIO = 12;
/** A partir desta inclinação (normal.y menor que isto), o chão vira pedra. */
const INCLINACAO_PEDRA = 0.8;

export class Terreno {
  private readonly alturas: Float32Array;
  /** Distância de cada ponto da grade até a beira da pista (m), usada nas cores. */
  private readonly foraDaPista: Float32Array;
  private readonly colunas: number;
  private readonly linhas: number;
  private readonly x0: number;
  private readonly z0: number;

  constructor(
    cena: Scene,
    fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly bioma: ConfigBioma,
    private readonly rio: DadosRio | undefined,
  ) {
    // Retângulo que envolve a pista inteira, mais a margem.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of tracado.pontos) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    this.x0 = minX - MARGEM;
    this.z0 = minZ - MARGEM;
    this.colunas = Math.ceil((maxX - minX + 2 * MARGEM) / ESPACAMENTO) + 1;
    this.linhas = Math.ceil((maxZ - minZ + 2 * MARGEM) / ESPACAMENTO) + 1;

    this.alturas = new Float32Array(this.colunas * this.linhas);
    this.foraDaPista = new Float32Array(this.colunas * this.linhas);
    const p = new Vector3();
    for (let l = 0; l < this.linhas; l++) {
      for (let c = 0; c < this.colunas; c++) {
        p.set(this.x0 + c * ESPACAMENTO, 0, this.z0 + l * ESPACAMENTO);
        const k = l * this.colunas + c;
        const { altura, fora } = this.calcularAltura(p);
        this.alturas[k] = altura;
        this.foraDaPista[k] = fora;
      }
    }

    const geometria = this.criarGeometria();
    const malha = new Mesh(
      geometria,
      new MeshStandardMaterial({ vertexColors: true, map: texturaDetalheChao(), roughness: 0.95, metalness: 0 }),
    );
    malha.receiveShadow = true;
    cena.add(malha);

    const posicoes = geometria.getAttribute('position').array as Float32Array;
    const indices = geometria.getIndex()?.array as Uint32Array;
    fisica.criarMalhaFixa(posicoes, indices);
  }

  /** Altura do chão em (x, z), interpolando os 4 pontos da grade em volta. */
  alturaEm(x: number, z: number): number {
    const gx = Math.min(Math.max((x - this.x0) / ESPACAMENTO, 0), this.colunas - 1.001);
    const gz = Math.min(Math.max((z - this.z0) / ESPACAMENTO, 0), this.linhas - 1.001);
    const c = Math.floor(gx);
    const l = Math.floor(gz);
    const tx = gx - c;
    const tz = gz - l;
    const a = this.alturas[l * this.colunas + c];
    const b = this.alturas[l * this.colunas + c + 1];
    const d = this.alturas[(l + 1) * this.colunas + c];
    const e = this.alturas[(l + 1) * this.colunas + c + 1];
    return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
  }

  // ---------------------------------------------------------------------------

  private calcularAltura(p: Vector3): { altura: number; fora: number } {
    const t = this.tracado;
    const proj = t.projetar(p);
    const i = proj.indice;
    const borda = t.meiaLarguraTotal;
    // Nas pontas da pista, a distância "lateral" não basta: um ponto 300 m
    // depois da chegada está a 0 m de lado. Ali usamos a distância de verdade.
    const nasPontas = i === 0 || i === t.quantidade - 1;
    const afastamento = nasPontas ? distanciaHorizontal(p, t.pontos[i]) : proj.afastamento;
    const lateral = Math.min(Math.max(proj.lateral, -borda), borda);
    const base = t.alturaSuperficie(i, lateral) - ABAIXO_DO_ASFALTO;

    const { alturaMorros, larguraMorros, subidaAoLonge, semente } = this.bioma.terreno;
    const fora = afastamento - borda;
    const inicioEncosta = FAIXA_PLANA + LARGURA_BARRANCO;
    const subida =
      FRACAO_BARRANCO * transicao(FAIXA_PLANA, inicioEncosta, fora) +
      (1 - FRACAO_BARRANCO) * transicao(inicioEncosta, inicioEncosta + LARGURA_ENCOSTA, fora);
    const morro = alturaMorros * (0.35 + 0.65 * ruidoMorros(p.x, p.z, larguraMorros, semente));
    const longe = Math.max(0, fora - 60) * subidaAoLonge;
    let altura = base + subida * (morro + longe);

    if (this.rio) altura = Math.min(altura, this.alturaComRio(p, altura));
    return { altura, fora };
  }

  /**
   * O rio corre perpendicular à pista no ponto da ponte. Perto da linha do
   * rio, o chão afunda até o leito; as margens descem em rampa.
   */
  private alturaComRio(p: Vector3, altura: number): number {
    const rio = this.rio;
    if (!rio) return altura;
    const t = this.tracado;
    const i = t.indiceEm(rio.distancia);
    const centro = t.pontos[i];
    const dx = p.x - centro.x;
    const dz = p.z - centro.z;
    // "ao longo" do rio = direção esquerda/direita da pista; "através" = direção da pista.
    const sinal = rio.cachoeira.lado === 'esquerda' ? 1 : -1;
    const aoLongo = (dx * t.esquerdas[i].x + dz * t.esquerdas[i].z) * sinal;
    const atraves = Math.abs(dx * t.tangentes[i].x + dz * t.tangentes[i].z);

    // O rio nasce na cachoeira (rio acima) e segue 600 m rio abaixo.
    const foraDoRio = Math.max(
      transicao(rio.largura / 2, rio.largura / 2 + MARGEM_RIO, atraves),
      transicao(rio.cachoeira.distancia, rio.cachoeira.distancia + 14, aoLongo),
      transicao(600, 640, -aoLongo),
    );
    const fundo = rio.nivel - PROFUNDIDADE_RIO;
    return fundo + (altura - fundo) * foraDoRio;
  }

  private criarGeometria(): BufferGeometry {
    const { colunas, linhas } = this;
    const posicoes = new Float32Array(colunas * linhas * 3);
    const uvs = new Float32Array(colunas * linhas * 2);
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < colunas; c++) {
        const k = l * colunas + c;
        const x = this.x0 + c * ESPACAMENTO;
        const z = this.z0 + l * ESPACAMENTO;
        posicoes.set([x, this.alturas[k], z], k * 3);
        // A textura de detalhe repete a cada 6 m.
        uvs.set([x / 6, z / 6], k * 2);
      }
    }
    const indices = new Uint32Array((colunas - 1) * (linhas - 1) * 6);
    let n = 0;
    for (let l = 0; l < linhas - 1; l++) {
      for (let c = 0; c < colunas - 1; c++) {
        const a = l * colunas + c;
        const b = a + 1;
        const d = a + colunas;
        const e = d + 1;
        // Dois triângulos por quadrado, no sentido que deixa a face para cima.
        indices.set([a, d, b, b, d, e], n);
        n += 6;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(posicoes, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setIndex(new Uint32BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    geo.setAttribute('color', new Float32BufferAttribute(this.calcularCores(geo), 3));
    return geo;
  }

  /** Cor de cada ponto: grama (dois tons), terra vermelha na beira da estrada, pedra nas encostas. */
  private calcularCores(geo: BufferGeometry): Float32Array {
    const { corGrama, corGramaEscura, corTerra, corRocha } = this.bioma.terreno;
    const grama = new Color(corGrama);
    const gramaEscura = new Color(corGramaEscura);
    const terra = new Color(corTerra);
    const rocha = new Color(corRocha);
    const normais = geo.getAttribute('normal');
    const posicoes = geo.getAttribute('position');
    const cores = new Float32Array(posicoes.count * 3);
    const cor = new Color();
    const p = new Vector3();
    for (let k = 0; k < posicoes.count; k++) {
      p.fromBufferAttribute(posicoes, k);
      cor.copy(grama).lerp(gramaEscura, ruido2D(p.x, p.z, 25, 3));
      cor.lerp(terra, 1 - transicao(2, 7, this.foraDaPista[k]));
      cor.lerp(rocha, 1 - transicao(INCLINACAO_PEDRA - 0.12, INCLINACAO_PEDRA, normais.getY(k)));
      cores.set([cor.r, cor.g, cor.b], k * 3);
    }
    return cores;
  }
}
