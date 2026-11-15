// Script de inspeção dos modelos .glb (roda com: node scripts/inspecionar-modelos.mjs)
//
// Por que existe: cada modelo baixado da internet vem numa escala e orientação
// diferentes (um carro de 400 m, uma árvore de 2 cm...). Antes de escrever o
// manifesto src/world/assets.ts, precisamos SABER o tamanho real de cada um.
//
// Um .glb é um arquivo binário com um pedaço JSON (a "planta" da cena) e um
// pedaço binário (os vértices). Para medir, basta ler o JSON: cada atributo
// POSITION já traz os valores mínimo e máximo, e os nós trazem as transformações.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Matrix4, Vector3, Quaternion, Box3 } from 'three';

const PASTA = 'public/models';
const detalhado = process.argv.includes('--nos');

function listarGlb(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return listarGlb(caminho);
    return nome.toLowerCase().endsWith('.glb') ? [caminho] : [];
  });
}

function lerJsonDoGlb(caminho) {
  const buf = readFileSync(caminho);
  // Cabeçalho de 12 bytes; o primeiro "chunk" é o JSON.
  const tamanhoJson = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + tamanhoJson).toString('utf8'));
}

function matrizDoNo(no) {
  const m = new Matrix4();
  if (no.matrix) return m.fromArray(no.matrix);
  const t = new Vector3(...(no.translation ?? [0, 0, 0]));
  const r = new Quaternion(...(no.rotation ?? [0, 0, 0, 1]));
  const s = new Vector3(...(no.scale ?? [1, 1, 1]));
  return m.compose(t, r, s);
}

function inspecionar(caminho) {
  const gltf = lerJsonDoGlb(caminho);
  const caixa = new Box3();
  let malhas = 0;
  let triangulos = 0;
  const nos = [];

  const visitar = (indice, matrizPai, profundidade) => {
    const no = gltf.nodes[indice];
    const matriz = matrizPai.clone().multiply(matrizDoNo(no));
    if (detalhado) nos.push(`${'  '.repeat(profundidade)}${no.name ?? '(sem nome)'}${no.mesh !== undefined ? ' [malha]' : ''}`);
    if (no.mesh !== undefined) {
      for (const prim of gltf.meshes[no.mesh].primitives) {
        malhas++;
        const acc = gltf.accessors[prim.attributes.POSITION];
        triangulos += prim.indices !== undefined ? gltf.accessors[prim.indices].count / 3 : acc.count / 3;
        // Transforma os 8 cantos da caixa local para o espaço do modelo.
        const [x0, y0, z0] = acc.min;
        const [x1, y1, z1] = acc.max;
        for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
          caixa.expandByPoint(new Vector3(x, y, z).applyMatrix4(matriz));
        }
      }
    }
    for (const filho of no.children ?? []) visitar(filho, matriz, profundidade + 1);
  };

  const cena = gltf.scenes[gltf.scene ?? 0];
  for (const raiz of cena.nodes) visitar(raiz, new Matrix4(), 0);
  const tam = caixa.getSize(new Vector3());
  return { tam, malhas, triangulos: Math.round(triangulos), nos, animacoes: (gltf.animations ?? []).length };
}

const filtro = process.argv.slice(2).find((a) => !a.startsWith('--'));
console.log('Arquivo | Largura X | Altura Y | Profund. Z | Malhas | Triângulos | Animações');
for (const caminho of listarGlb(PASTA)) {
  if (filtro && !caminho.includes(filtro)) continue;
  const r = inspecionar(caminho);
  const f = (n) => n.toFixed(2);
  console.log(`${relative(PASTA, caminho)} | ${f(r.tam.x)} | ${f(r.tam.y)} | ${f(r.tam.z)} | ${r.malhas} | ${r.triangulos} | ${r.animacoes}`);
  if (detalhado) console.log(r.nos.join('\n'));
}
