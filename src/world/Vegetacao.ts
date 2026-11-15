import { Box3, Euler, Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { MundoFisico } from '../physics/MundoFisico';
import type { ConfigQualidade } from '../config/quality';
import type { ConfigBioma, PlantaModelo } from './biomas';
import { obterModelo } from './CarregadorModelos';
import { MODELOS, type InfoModelo } from './assets';
import { pontosDoModelo } from './FormaColisor';
import { criarArvoreLeve, criarInstancias } from './Instancias';
import type { Lado } from './levels/TiposFase';
import { criarSorteio } from './Ruido';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// VEGETAÇÃO: espalha árvores e pedras dos dois lados da pista.
// =============================================================================
// Perto da pista: modelos .glb detalhados (o jogador passa colado neles).
// Ao longe: árvores leves geradas por código. Ver biomas.ts.
//
// Cada planta sorteia: um ponto da pista, um lado, uma distância da beira,
// um giro e um tamanho. Se cair em cima de outro trecho da estrada (nas
// curvas em "S" a pista passa perto de si mesma) ou dentro do rio, é descartada.
// =============================================================================

/** Medidas do tronco da árvore leve (Instancias.ts) numa árvore de escala 1: raio da base e altura. */
const RAIO_TRONCO_LEVE = 0.04;
const ALTURA_TRONCO_LEVE = 0.35;
/** Quanto (m) cada planta é enterrada no chão (ver sortearPosicoes). */
const ENTERRADA = 0.4;

/** Contexto comum a todas as plantas. */
interface Plantio {
  cena: Scene;
  fisica: MundoFisico;
  tracado: Tracado;
  terreno: Terreno;
  /** Abaixo desta altura é água: nada nasce ali. */
  nivelAgua: number;
  sorteio: () => number;
}

/**
 * O que a qualidade gráfica pode mudar na vegetação depois de pronta:
 * esconder as árvores pesadas e ligar/desligar a sombra das plantas.
 */
export class ControleVegetacao {
  /** Todas as malhas de planta (para ligar/desligar a sombra). */
  readonly malhas: InstancedMesh[] = [];
  /** Só as das árvores pesadas, e os colisores delas. */
  readonly pesadas: InstancedMesh[] = [];
  readonly colisoresPesados: RAPIER.Collider[] = [];

  aplicarQualidade(q: ConfigQualidade): void {
    for (const m of this.malhas) m.castShadow = q.sombraCenario;
    for (const m of this.pesadas) m.visible = q.arvoresDetalhadas;
    // Árvore escondida não pode virar um obstáculo invisível.
    for (const c of this.colisoresPesados) c.setEnabled(q.arvoresDetalhadas);
  }
}

export async function plantarVegetacao(
  cena: Scene,
  fisica: MundoFisico,
  tracado: Tracado,
  terreno: Terreno,
  bioma: ConfigBioma,
  nivelAgua = -Infinity,
): Promise<ControleVegetacao> {
  // Semente fixa: a mesma fase tem sempre a mesma floresta. Por isso
  // sorteamos TODAS as posições antes de esperar os arquivos: se o sorteio
  // acontecesse depois do download, a ordem de chegada dos arquivos (que
  // varia) mudaria a floresta.
  const plantio: Plantio = { cena, fisica, tracado, terreno, nivelAgua, sorteio: criarSorteio(bioma.terreno.semente) };
  const controle = new ControleVegetacao();

  const todas = [...bioma.plantasPerto, ...bioma.pedras];
  const sorteios = todas.map((planta) => sortearPosicoes(plantio, planta.porKm, bioma.faixaPerto, planta.escala));
  const leve = bioma.arvoresLonge;
  const matrizesLeves = sortearPosicoes(plantio, leve.porKm, leve.faixa, [6, 13]);

  await Promise.all(todas.map((planta, k) => plantarModelo(plantio, planta, sorteios[k], controle)));
  controle.malhas.push(...criarInstancias(cena, criarArvoreLeve(leve.corCopa, leve.corTronco), matrizesLeves.map((m) => m.matriz)));
  // As árvores de longe também têm tronco sólido: no passeio o carro chega
  // até elas. (Antes, ninguém passava dos 14 m fora da pista, e elas eram só
  // cenário.) Um cilindro fixo é barato para a física, mesmo aos milhares:
  // o Rapier só faz a conta fina com os que estão perto do carro.
  for (const { posicao, escala } of matrizesLeves) {
    const meiaAltura = ALTURA_TRONCO_LEVE * escala * 0.5;
    plantio.fisica.criarCilindroFixo(
      { x: posicao.x, y: posicao.y - ENTERRADA + meiaAltura, z: posicao.z },
      RAIO_TRONCO_LEVE * escala,
      meiaAltura,
    );
  }
  return controle;
}

async function plantarModelo(plantio: Plantio, planta: PlantaModelo, sorteadas: Sorteada[], controle: ControleVegetacao): Promise<void> {
  const modelo = await obterModelo(planta.modelo);
  const malhas = criarInstancias(plantio.cena, modelo, sorteadas.map((s) => s.matriz));
  controle.malhas.push(...malhas);
  if (planta.pesada) controle.pesadas.push(...malhas);

  // Sólidos irregulares (pedras): colisor com o formato justo do modelo.
  const info: InfoModelo = MODELOS[planta.modelo];
  if (info.solido) {
    for (const { matriz } of sorteadas) {
      const colisor = plantio.fisica.criarCascoFixo(pontosDoModelo(modelo, matriz));
      if (colisor && planta.pesada) controle.colisoresPesados.push(colisor);
    }
    return;
  }

  // Árvores: só o tronco segura o carro (a copa fica lá no alto).
  if (planta.raioColisor === undefined) return;
  const altura = Math.min(new Box3().setFromObject(modelo).getSize(new Vector3()).y, 4);
  for (const { posicao, escala } of sorteadas) {
    const meiaAltura = (altura * escala) / 2;
    const colisor = plantio.fisica.criarCilindroFixo(
      { x: posicao.x, y: posicao.y + meiaAltura, z: posicao.z },
      planta.raioColisor * escala,
      meiaAltura,
    );
    if (planta.pesada) controle.colisoresPesados.push(colisor);
  }
}

interface Sorteada {
  matriz: Matrix4;
  posicao: Vector3;
  escala: number;
}

/**
 * Sorteia posições ao longo da pista. `faixa`: de quantos a quantos metros
 * depois da beira do acostamento. `escala`: tamanho mínimo e máximo.
 */
function sortearPosicoes(plantio: Plantio, porKm: number, faixa: [number, number], escala: [number, number]): Sorteada[] {
  const { tracado, terreno, sorteio } = plantio;
  const quantidade = Math.round((porKm * tracado.comprimento) / 1000);
  const borda = tracado.meiaLarguraTotal;
  const resultado: Sorteada[] = [];
  const giro = new Quaternion();
  const eixoY = new Euler();

  for (let k = 0; k < quantidade; k++) {
    const distancia = sorteio() * tracado.comprimento;
    const lado: Lado = sorteio() < 0.5 ? 'esquerda' : 'direita';
    const afastamento = borda + faixa[0] + sorteio() * (faixa[1] - faixa[0]);
    const p = tracado.pontoAoLado(distancia, lado, afastamento);
    // Caiu perto de OUTRO trecho da pista? Descarta.
    if (tracado.projetar(p).afastamento < borda + faixa[0] - 0.5) continue;
    p.y = terreno.alturaEm(p.x, p.z);
    if (p.y < plantio.nivelAgua + 0.5) continue;
    if (terreno.estaEmPatio(p)) continue;

    const tamanho = escala[0] + sorteio() * (escala[1] - escala[0]);
    giro.setFromEuler(eixoY.set(0, sorteio() * Math.PI * 2, 0));
    const posicao = p.clone().setY(p.y - ENTERRADA); // enterra um pouco: em encosta, a base não flutua
    resultado.push({ matriz: new Matrix4().compose(posicao, giro, new Vector3(tamanho, tamanho, tamanho)), posicao: p, escala: tamanho });
  }
  return resultado;
}
