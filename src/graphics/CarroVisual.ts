import { Box3, Group, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import type { RodasDoModelo } from '../world/assets';
import type { EstadoRoda, GeometriaCarro } from '../physics/VeiculoFisico';
import { tuning } from '../config/tuning';

// A parte visual do carro: o modelo 3D com as rodas separadas da carroceria.
//
// O .glb vem com as rodas "grudadas" no modelo. Para elas girarem e
// esterçarem, cada roda é movida para dentro de dois grupos:
//   pivoDirecao (gira em Y = volante)  ->  pivoGiro (gira no eixo da roda)  ->  malha
// O pivô fica no centro da roda; sem isso ela giraria em torno da origem do
// carro, como uma roda-gigante.
//
// "Eixo da roda" é medido na própria malha, e não suposto como o X do carro:
// no Carro1, as rodas do lado direito vêm do modelo levemente inclinadas, e
// girar uma roda torta em torno de outro eixo faz ela "rebolar".
//
// Bônus: medindo as rodas do modelo, sabemos onde colocar as rodas da física.
// Cada carro novo funciona sem ninguém digitar coordenadas à mão.

interface RodaVisual {
  pivoDirecao: Object3D;
  pivoGiro: Object3D;
  /** Rodas da física que esta peça representa (2 quando o eixo é uma malha só). */
  indices: number[];
  centro: Vector3;
  /** Eixo em torno do qual a roda gira (medido na malha). */
  eixo: Vector3;
}

/** Largura de um pneu como fração do diâmetro (medido no Carro2). */
const LARGURA_PNEU_SOBRE_DIAMETRO = 0.45;

export class CarroVisual {
  readonly objeto: Group;
  readonly geometria: GeometriaCarro;
  private readonly rodas: RodaVisual[] = [];

  constructor(modelo: Group, nomesRodas: RodasDoModelo) {
    this.objeto = modelo;
    modelo.updateMatrixWorld(true);

    const nomes = [
      nomesRodas.dianteiraEsquerda,
      nomesRodas.dianteiraDireita,
      nomesRodas.traseiraEsquerda,
      nomesRodas.traseiraDireita,
    ];
    const centrosFisica: Vector3[] = [];
    let raio = 0;

    nomes.forEach((nome, indice) => {
      const jaSeparada = this.rodas.find((r) => r.pivoGiro.getObjectByName(nome));
      if (jaSeparada) {
        // Eixo inteiro numa malha só (Carro2): a mesma peça vale por duas rodas.
        jaSeparada.indices.push(indice);
        centrosFisica.push(this.centroDeUmLado(jaSeparada, indice));
        return;
      }
      const no = modelo.getObjectByName(nome);
      if (!no) throw new Error(`Roda "${nome}" não encontrada no modelo. Confira src/world/assets.ts.`);
      const caixa = new Box3().setFromObject(no, true);
      const centro = caixa.getCenter(new Vector3());
      raio = Math.max(raio, caixa.getSize(new Vector3()).y / 2);

      const pivoDirecao = new Object3D();
      pivoDirecao.position.copy(centro);
      const pivoGiro = new Object3D();
      pivoDirecao.add(pivoGiro);
      modelo.add(pivoDirecao);
      modelo.updateMatrixWorld(true);
      // attach() troca o "pai" mantendo a roda onde ela estava na tela.
      pivoGiro.attach(no);

      const roda: RodaVisual = { pivoDirecao, pivoGiro, indices: [indice], centro, eixo: eixoDaRoda(pivoGiro, no) };
      this.rodas.push(roda);
      const eixoInteiro = nomes.filter((n) => n === nome).length > 1;
      centrosFisica.push(eixoInteiro ? this.centroDeUmLado(roda, indice) : centro.clone());
    });

    this.geometria = {
      rodas: centrosFisica as [Vector3, Vector3, Vector3, Vector3],
      raioRoda: raio,
      ...this.medirCarroceria(),
    };
  }

  /** Posiciona o carro e as rodas para este quadro. */
  atualizar(posicao: Vector3, rotacao: Quaternion, estados: EstadoRoda[]): void {
    this.objeto.position.copy(posicao);
    this.objeto.quaternion.copy(rotacao);
    for (const roda of this.rodas) {
      // Uma peça que vale por duas rodas usa a média das duas suspensões.
      const doEixo = roda.indices.map((i) => estados[i]);
      const suspensao = doEixo.reduce((s, e) => s + e.comprimentoSuspensao, 0) / doEixo.length;
      // A física diz quanto a mola está esticada; o centro da roda fica a essa
      // distância abaixo do ponto de fixação (que está `comprimentoRepouso` acima).
      roda.pivoDirecao.position.y = roda.centro.y + tuning.suspensao.comprimentoRepouso - suspensao;
      roda.pivoDirecao.rotation.y = doEixo[0].anguloDirecao;
      roda.pivoGiro.quaternion.setFromAxisAngle(roda.eixo, doEixo[0].giro);
    }
  }

  /** Para uma peça de eixo inteiro, estima o centro da roda de um dos lados. */
  private centroDeUmLado(roda: RodaVisual, indice: number): Vector3 {
    const caixa = new Box3().setFromObject(roda.pivoGiro, true);
    const tamanho = caixa.getSize(new Vector3());
    const meiaLarguraPneu = (tamanho.y * LARGURA_PNEU_SOBRE_DIAMETRO) / 2;
    const esquerda = indice % 2 === 0; // índices pares (0, 2) são do lado esquerdo (+X)
    const x = (esquerda ? caixa.max.x : caixa.min.x) + (esquerda ? -meiaLarguraPneu : meiaLarguraPneu);
    return new Vector3(x, roda.centro.y, roda.centro.z);
  }

  /**
   * Caixa de colisão da carroceria: só a lataria, sem as rodas. A base fica na
   * altura do centro das rodas: quem toca o chão são os raios da suspensão,
   * nunca a caixa (senão o carro "raspa" em toda lombada).
   */
  private medirCarroceria(): Pick<GeometriaCarro, 'centroCaixa' | 'meiasMedidas'> {
    const caixa = new Box3();
    const pivos = new Set<Object3D>(this.rodas.map((r) => r.pivoDirecao));
    this.objeto.updateMatrixWorld(true);
    this.objeto.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      let pai: Object3D | null = obj;
      while (pai) {
        if (pivos.has(pai)) return; // é roda
        pai = pai.parent;
      }
      caixa.expandByObject(obj, true);
    });
    const base = this.rodas[0].centro.y;
    // Um pouco menor que o modelo: a caixa é invisível, e encolher evita que o
    // carro "bata" num muro que visualmente ainda não encostou.
    const meiaLargura = ((caixa.max.x - caixa.min.x) / 2) * 0.92;
    const meioComprimento = ((caixa.max.z - caixa.min.z) / 2) * 0.95;
    const topo = base + (caixa.max.y - base) * 0.85;
    const meiaAltura = (topo - base) / 2;
    return {
      centroCaixa: new Vector3((caixa.max.x + caixa.min.x) / 2, base + meiaAltura, (caixa.max.z + caixa.min.z) / 2),
      meiasMedidas: new Vector3(meiaLargura, meiaAltura, meioComprimento),
    };
  }
}

/**
 * Descobre o eixo real de uma roda: dos três eixos da malha, o que aponta mais
 * para o lado do carro (X). Funciona também para o eixo traseiro do Carro2, em
 * que as duas rodas são uma malha só.
 */
function eixoDaRoda(pivoGiro: Object3D, roda: Object3D): Vector3 {
  let malha: Object3D = roda;
  roda.traverse((o) => {
    if (o instanceof Mesh && !(malha instanceof Mesh)) malha = o;
  });
  pivoGiro.updateMatrixWorld(true);
  // Orientação da malha vista de dentro do pivô (que não tem rotação própria).
  const relativa = new Matrix4().copy(pivoGiro.matrixWorld).invert().multiply(malha.matrixWorld);
  const eixos = [new Vector3(), new Vector3(), new Vector3()];
  relativa.extractBasis(eixos[0], eixos[1], eixos[2]);
  const lado = new Vector3(1, 0, 0);
  const melhor = eixos.map((e) => e.normalize()).reduce((a, b) => (Math.abs(b.dot(lado)) > Math.abs(a.dot(lado)) ? b : a));
  // Sentido positivo para +X: assim "giro positivo" é andar para a frente em todas as rodas.
  return melhor.dot(lado) < 0 ? melhor.negate() : melhor;
}
