import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Color,
  Vector3,
  type Object3D,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =============================================================================
// INSTÂNCIAS: desenhar o mesmo modelo centenas de vezes, barato.
// =============================================================================
// Cada Mesh na cena custa uma "chamada de desenho" (draw call) à placa de
// vídeo, e é o número de chamadas, mais do que o de triângulos, que derruba o
// fps em vídeo integrado. 300 árvores × 2 peças = 600 chamadas.
//
// Com InstancedMesh, a placa de vídeo recebe a geometria UMA vez e uma lista
// de posições, e desenha todas as cópias numa chamada só.
//
// Dois cuidados:
//  1. Juntamos as peças do modelo que usam o mesmo material (a árvore com
//     cipós tem 80 peças!) numa geometria só: menos InstancedMesh.
//  2. Dividimos as cópias em blocos de 120 × 120 m. Assim a câmera ainda
//     consegue ignorar os blocos que estão fora da tela ou além da neblina.
// =============================================================================

/** Tamanho dos blocos (m). Menor: corta mais o que está fora da tela, mas são mais chamadas. */
const TAMANHO_BLOCO = 120;

/** Une as peças do modelo por material. */
function juntarPorMaterial(modelo: Object3D): { geometria: BufferGeometry; material: Material }[] {
  modelo.updateMatrixWorld(true);
  const grupos = new Map<Material, BufferGeometry[]>();
  modelo.traverse((obj) => {
    if (!(obj instanceof Mesh) || Array.isArray(obj.material)) return;
    const material = obj.material as Material;
    // Leva a peça para a posição que ela tem dentro do modelo.
    const geo = (obj.geometry as BufferGeometry).clone().applyMatrix4(obj.matrixWorld);
    const lista = grupos.get(material) ?? [];
    lista.push(geo);
    grupos.set(material, lista);
  });

  const resultado: { geometria: BufferGeometry; material: Material }[] = [];
  for (const [material, geos] of grupos) {
    const usaCor = 'vertexColors' in material && material.vertexColors === true;
    const compativeis = geos.map((g) => soAtributosComuns(g, usaCor));
    // mergeGeometries exige que todas sejam indexadas ou todas não indexadas.
    const todasIndexadas = compativeis.every((g) => g.index !== null);
    const prontas = todasIndexadas ? compativeis : compativeis.map((g) => (g.index ? g.toNonIndexed() : g));
    const unida = mergeGeometries(prontas, false);
    if (unida) resultado.push({ geometria: unida, material });
    else for (const g of prontas) resultado.push({ geometria: g, material }); // não deu para unir: vai separado
  }
  return resultado;
}

/** Deixa só posição, normal, uv (e cor, se o material usa): todas as peças ficam com os mesmos atributos. */
function soAtributosComuns(geo: BufferGeometry, usaCor: boolean): BufferGeometry {
  const n = geo.getAttribute('position').count;
  for (const nome of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(nome)) geo.deleteAttribute(nome);
  }
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  if (!geo.getAttribute('uv')) geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (usaCor && !geo.getAttribute('color')) geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (!usaCor && geo.getAttribute('color')) geo.deleteAttribute('color');
  // Cores com 4 componentes (RGBA) não se juntam com as de 3; normalizamos.
  const cor = geo.getAttribute('color');
  if (cor && cor.itemSize !== 3) {
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.set([cor.getX(i), cor.getY(i), cor.getZ(i)], i * 3);
    geo.setAttribute('color', new Float32BufferAttribute(rgb, 3));
  }
  return geo;
}

/**
 * Coloca cópias de `modelo` em cada uma das `transformacoes` (posição,
 * rotação e escala de cada cópia).
 */
export function criarInstancias(cena: Scene, modelo: Object3D, transformacoes: Matrix4[], sombra = true): InstancedMesh[] {
  const criadas: InstancedMesh[] = [];
  if (transformacoes.length === 0) return criadas;
  const pecas = juntarPorMaterial(modelo);
  const posicao = new Vector3();

  // Separa as cópias por bloco do mapa.
  const blocos = new Map<string, Matrix4[]>();
  for (const m of transformacoes) {
    posicao.setFromMatrixPosition(m);
    const chave = `${Math.floor(posicao.x / TAMANHO_BLOCO)},${Math.floor(posicao.z / TAMANHO_BLOCO)}`;
    const lista = blocos.get(chave) ?? [];
    lista.push(m);
    blocos.set(chave, lista);
  }

  for (const lista of blocos.values()) {
    for (const { geometria, material } of pecas) {
      const malha = new InstancedMesh(geometria, material, lista.length);
      lista.forEach((m, i) => malha.setMatrixAt(i, m));
      // Esfera que envolve as cópias deste bloco: é por ela que a câmera
      // decide se o bloco está na tela.
      malha.computeBoundingSphere();
      malha.castShadow = sombra;
      malha.receiveShadow = true;
      cena.add(malha);
      criadas.push(malha);
    }
  }
  return criadas;
}

/**
 * Árvore "leve" para o fundo: tronco + duas copas em cone, ~40 triângulos.
 * Tem 1 m de altura; a escala de cada cópia define o tamanho real.
 */
export function criarArvoreLeve(corCopa: number, corTronco: number): Mesh {
  const tronco = new CylinderGeometry(0.025, 0.04, 0.35, 5).translate(0, 0.175, 0);
  const copaBaixa = new ConeGeometry(0.3, 0.5, 6).translate(0, 0.5, 0);
  const copaAlta = new ConeGeometry(0.21, 0.4, 6).translate(0, 0.78, 0);
  const pintar = (g: BufferGeometry, cor: number, variacao: number): BufferGeometry => {
    const c = new Color(cor).multiplyScalar(variacao);
    const n = g.getAttribute('position').count;
    const cores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cores.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(cores, 3));
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  };
  const geo = mergeGeometries([pintar(tronco, corTronco, 1), pintar(copaBaixa, corCopa, 1), pintar(copaAlta, corCopa, 1.15)]);
  if (!geo) throw new Error('Não consegui montar a árvore leve.');
  // flatShading: faces com cor chapada, o estilo "low poly" dos outros modelos.
  return new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
}
