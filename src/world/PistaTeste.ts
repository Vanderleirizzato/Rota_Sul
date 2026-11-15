import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { texturaAsfalto } from '../graphics/Texturas';
import { LUZ_PADRAO } from '../graphics/Iluminacao';
import type { Cenario } from './Cenario';

// =============================================================================
// PISTA DE TESTE (Etapa 1)
// =============================================================================
// Um plano grande de asfalto com um circuito pintado no chão, uma rampa e um
// círculo para treinar drift. Serve para acertar a física do carro sem
// cenário atrapalhando. As fases de verdade usam o construtor de pistas
// (Fase.ts); esta continua existindo para testes: abra o jogo com ?fase=teste
// no endereço (ex.: http://localhost:5173/?fase=teste).
// =============================================================================

/** Trecho do circuito: reta (comprimento) ou curva (raio e ângulo; + = esquerda). */
type Trecho = { reta: number } | { raio: number; graus: number };

/** O circuito, descrito como um "passeio de tartaruga": anda, vira, anda... */
const CIRCUITO: Trecho[] = [
  { reta: 450 }, // a reta longa, para testar velocidade máxima e nitro
  { raio: 60, graus: 90 }, // curva aberta
  { reta: 140 },
  { raio: 30, graus: 90 }, // curva fechada
  { reta: 450 },
  { raio: 60, graus: 90 },
  { reta: 140 },
  { raio: 30, graus: 90 },
];

const LARGURA_PISTA = 12;
const TAMANHO_PLANO = 1400;
/** Centro do plano: o circuito vai de X 0 a 230 e de Z 0 a 510. */
const CENTRO_PLANO = new Vector3(115, 0, 255);

const RAMPA = { x: 115, zInicio: 120, largura: 10, comprimento: 18, graus: 12 };
const CIRCULO_DRIFT = { x: 115, z: 400, raio: 25 };

/** Onde o carro nasce: no começo da reta longa, apontando para +Z. */
export const LARGADA_TESTE = { posicao: new Vector3(0, 1, 5), angulo: 0 };

export function criarPistaTeste(cena: Scene, fisica: MundoFisico): Cenario {
  criarChao(cena, fisica);
  criarMuros(cena, fisica);
  criarRampa(cena, fisica);
  criarPinturas(cena);
  return {
    id: 'teste',
    nome: 'Pista de teste',
    local: 'Física do carro',
    largada: LARGADA_TESTE,
    tracado: null, // plano aberto: sem traçado
    chegada: null, // sem corrida nem cronômetro
    luz: LUZ_PADRAO,
    atualizar() {},
    passoFisica() {}, // sem trânsito na pista de teste
    colherImpactos: () => ({ plastico: 0, macio: 0, metal: 0 }),
    pegouTrofeu: () => false,
    reiniciar() {},
    areaLivre: () => true, // plano aberto: dá para andar em qualquer lugar
    nivelMar: null,
    aplicarQualidade() {}, // nada pesado aqui
  };
}

// ----------------------------------------------------------------------------

function criarChao(cena: Scene, fisica: MundoFisico): void {
  const textura = texturaAsfalto();
  textura.repeat.set(TAMANHO_PLANO / 8, TAMANHO_PLANO / 8);
  const chao = new Mesh(
    new PlaneGeometry(TAMANHO_PLANO, TAMANHO_PLANO),
    new MeshStandardMaterial({ map: textura, roughness: 0.92, metalness: 0 }),
  );
  chao.rotation.x = -Math.PI / 2;
  chao.position.copy(CENTRO_PLANO);
  chao.receiveShadow = true;
  cena.add(chao);
  // Colisor: caixa grossa com o topo em Y = 0. Grossa para nada atravessar.
  fisica.criarCaixaFixa({ x: CENTRO_PLANO.x, y: -1, z: CENTRO_PLANO.z }, TAMANHO_PLANO / 2, 1, TAMANHO_PLANO / 2);
}

/** Muros nas bordas: o jogador não pode cair para fora do mundo. */
function criarMuros(cena: Scene, fisica: MundoFisico): void {
  const material = new MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.8 });
  const meio = TAMANHO_PLANO / 2;
  const lados = [
    { dx: 0, dz: meio, ml: meio, mc: 0.5 },
    { dx: 0, dz: -meio, ml: meio, mc: 0.5 },
    { dx: meio, dz: 0, ml: 0.5, mc: meio },
    { dx: -meio, dz: 0, ml: 0.5, mc: meio },
  ];
  for (const l of lados) {
    const centro = { x: CENTRO_PLANO.x + l.dx, y: 1, z: CENTRO_PLANO.z + l.dz };
    fisica.criarCaixaFixa(centro, l.ml, 1, l.mc);
    const muro = new Mesh(new BoxGeometry(l.ml * 2, 2, l.mc * 2), material);
    muro.position.set(centro.x, centro.y, centro.z);
    muro.castShadow = muro.receiveShadow = true;
    cena.add(muro);
  }
}

function criarRampa(cena: Scene, fisica: MundoFisico): void {
  const { x, zInicio, largura, comprimento, graus } = RAMPA;
  const espessura = 1;
  const angulo = (graus * Math.PI) / 180;
  // Girar em X com ângulo negativo levanta a ponta +Z (a saída da rampa).
  const rotacao = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -angulo);
  // Queremos que o TOPO da caixa comece rente ao chão em zInicio. Calculamos o
  // centro do topo e descemos meia espessura na direção "cima" da rampa.
  const centroTopo = new Vector3(x, (comprimento / 2) * Math.sin(angulo), zInicio + (comprimento / 2) * Math.cos(angulo));
  const cimaRampa = new Vector3(0, 1, 0).applyQuaternion(rotacao);
  const centro = centroTopo.addScaledVector(cimaRampa, -espessura / 2);

  fisica.criarCaixaFixa(centro, largura / 2, espessura / 2, comprimento / 2, rotacao);
  const rampa = new Mesh(
    new BoxGeometry(largura, espessura, comprimento),
    new MeshStandardMaterial({ color: 0xd9822b, roughness: 0.7 }),
  );
  rampa.position.copy(centro);
  rampa.quaternion.copy(rotacao);
  rampa.castShadow = rampa.receiveShadow = true;
  cena.add(rampa);
}

// ----------------------------------------------------------------------------
// Pinturas no chão
// ----------------------------------------------------------------------------

function criarPinturas(cena: Scene): void {
  const pontos = percorrerCircuito(CIRCUITO, 2);
  const borda = LARGURA_PISTA / 2 - 0.2;
  const brancas = [
    ...fitaAoLongo(pontos, borda, 0.25),
    ...fitaAoLongo(pontos, -borda, 0.25),
    ...fitaAoLongo(pontos, 0, 0.18, { pintado: 3, vazio: 4 }),
    ...fitaAoLongo(circulo(CIRCULO_DRIFT.x, CIRCULO_DRIFT.z, CIRCULO_DRIFT.raio), 0, 0.4),
    // Corredor de aproximação da rampa
    ...fitaAoLongo(linhaReta(RAMPA.x + RAMPA.largura / 2, 20, RAMPA.zInicio), 0, 0.25),
    ...fitaAoLongo(linhaReta(RAMPA.x - RAMPA.largura / 2, 20, RAMPA.zInicio), 0, 0.25),
  ];
  cena.add(malhaDePintura(brancas, 0xf2f2f2));
  // Largada: faixa xadrez atravessando a pista.
  cena.add(malhaDePintura(xadrez(0, LARGADA_TESTE.posicao.z + 6, LARGURA_PISTA), 0xffffff));
}

/** Gera os pontos do circuito a cada `espacamento` metros. */
function percorrerCircuito(trechos: Trecho[], espacamento: number): Vector3[] {
  const pontos: Vector3[] = [];
  const p = new Vector3(0, 0, 0);
  let direcao = 0; // ângulo em Y: 0 = olhando para +Z; positivo = virou à esquerda
  pontos.push(p.clone());
  for (const t of trechos) {
    if ('reta' in t) {
      const passos = Math.ceil(t.reta / espacamento);
      const frente = new Vector3(Math.sin(direcao), 0, Math.cos(direcao));
      for (let i = 0; i < passos; i++) pontos.push(p.addScaledVector(frente, t.reta / passos).clone());
    } else {
      const total = (t.graus * Math.PI) / 180;
      const passos = Math.ceil((Math.abs(total) * t.raio) / espacamento);
      const sinal = Math.sign(total);
      // O centro da curva fica ao lado do carro, a uma distância igual ao raio.
      const centro = p.clone().addScaledVector(esquerdaDe(direcao), sinal * t.raio);
      for (let i = 1; i <= passos; i++) {
        const a = direcao + (total * i) / passos;
        p.copy(centro).addScaledVector(esquerdaDe(a), -sinal * t.raio);
        pontos.push(p.clone());
      }
      direcao += total;
    }
  }
  return pontos;
}

/** Vetor que aponta para a esquerda de quem olha na direção `angulo`. */
function esquerdaDe(angulo: number): Vector3 {
  return new Vector3(Math.cos(angulo), 0, -Math.sin(angulo));
}

function circulo(cx: number, cz: number, raio: number): Vector3[] {
  const pontos: Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    pontos.push(new Vector3(cx + Math.cos(a) * raio, 0, cz + Math.sin(a) * raio));
  }
  return pontos;
}

function linhaReta(x: number, comprimento: number, zFim: number): Vector3[] {
  return [new Vector3(x, 0, zFim - comprimento), new Vector3(x, 0, zFim)];
}

/** Um quadrilátero (4 cantos), em sentido que fique virado para cima. */
type Quad = [Vector3, Vector3, Vector3, Vector3];

/**
 * Faixa pintada que acompanha uma linha de pontos, deslocada para o lado.
 * Opcionalmente tracejada (metros pintados / metros vazios).
 */
function fitaAoLongo(pontos: Vector3[], deslocamento: number, largura: number, tracejado?: { pintado: number; vazio: number }): Quad[] {
  const quads: Quad[] = [];
  let percorrido = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const trecho = b.clone().sub(a);
    const comprimento = trecho.length();
    const meio = percorrido + comprimento / 2;
    percorrido += comprimento;
    if (tracejado && meio % (tracejado.pintado + tracejado.vazio) > tracejado.pintado) continue;
    const lado = new Vector3(trecho.z, 0, -trecho.x).normalize(); // esquerda do trecho
    const a1 = a.clone().addScaledVector(lado, deslocamento - largura / 2);
    const a2 = a.clone().addScaledVector(lado, deslocamento + largura / 2);
    const b1 = b.clone().addScaledVector(lado, deslocamento - largura / 2);
    const b2 = b.clone().addScaledVector(lado, deslocamento + largura / 2);
    quads.push([a1, b1, b2, a2]);
  }
  return quads;
}

function xadrez(xCentro: number, z: number, largura: number): Quad[] {
  const quads: Quad[] = [];
  const lado = 1;
  for (let i = 0; i < largura / lado; i++) {
    for (let j = 0; j < 2; j++) {
      if ((i + j) % 2) continue;
      const x0 = xCentro - largura / 2 + i * lado;
      const z0 = z + j * lado;
      quads.push([new Vector3(x0, 0, z0), new Vector3(x0, 0, z0 + lado), new Vector3(x0 + lado, 0, z0 + lado), new Vector3(x0 + lado, 0, z0)]);
    }
  }
  return quads;
}

/**
 * Junta todas as faixas de uma cor numa ÚNICA malha. Mil faixas separadas
 * seriam mil "chamadas de desenho" à placa de vídeo; juntas, é uma só.
 */
function malhaDePintura(quads: Quad[], cor: number): Mesh {
  const posicoes: number[] = [];
  const ALTURA = 0.02; // um fio acima do asfalto
  for (const [p0, p1, p2, p3] of quads) {
    for (const p of [p0, p1, p2, p0, p2, p3]) posicoes.push(p.x, ALTURA, p.z);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(posicoes, 3));
  geo.computeVertexNormals();
  const mat = new MeshStandardMaterial({
    color: cor,
    roughness: 0.6,
    // polygonOffset evita o "z-fighting": a tinta piscando com o asfalto embaixo.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide, // dos dois lados: não precisamos nos preocupar com o sentido dos triângulos
  });
  const malha = new Mesh(geo, mat);
  malha.receiveShadow = true;
  return malha;
}
