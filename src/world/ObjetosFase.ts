import { Box3, Matrix4, Quaternion, Vector3, MathUtils, type Object3D, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { pontosDoModelo } from './FormaColisor';
import { obterModelo } from './CarregadorModelos';
import { criarInstancias } from './Instancias';
import type { ObjetoFase } from './levels/TiposFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// Coloca na pista os objetos listados nos dados da fase (paredões, pedras
// grandes, o arco...) e cria um colisor para os sólidos.
//
// Colisor: o "casco convexo" do modelo (ver FormaColisor.ts), que embrulha a
// pedra bem justo. Não usamos a malha exata (milhares de triângulos deixam a
// física lenta), nem uma caixa (os cantos dela sobram para fora da pedra e
// viram obstáculos invisíveis). Arcos usam duas caixas, uma por pilar.

const EIXO_Y = new Vector3(0, 1, 0);

export async function colocarObjetos(
  cena: Scene,
  fisica: MundoFisico,
  tracado: Tracado,
  terreno: Terreno,
  objetos: ObjetoFase[],
): Promise<void> {
  await Promise.all(objetos.map((o) => colocarObjeto(cena, fisica, tracado, terreno, o)));
}

/** Coloca um objeto (e o colisor dele) e devolve o modelo, para quem quiser enfeitá-lo depois. */
export async function colocarObjeto(cena: Scene, fisica: MundoFisico, tracado: Tracado, terreno: Terreno, o: ObjetoFase): Promise<Object3D> {
  const modelo = await obterModelo(o.modelo);
  const i = tracado.indiceEm(o.distancia);
  const posicao = tracado.pontoAoLado(o.distancia, o.lado, o.afastamento);
  // Em cima da pista: apoia no asfalto. Fora dela: apoia no terreno.
  posicao.y = (o.lado === 'centro' ? tracado.alturaSuperficie(i, 0) : terreno.alturaEm(posicao.x, posicao.z)) + (o.altura ?? 0);
  // Navios e afins: altura fixa (no mar não há "chão" onde apoiar).
  if (o.alturaAbsoluta !== undefined) posicao.y = o.alturaAbsoluta;

  // Ângulo: no centro, o objeto olha na direção da pista; dos lados, olha PARA a pista.
  const e = tracado.esquerdas[i];
  const paraPista = o.lado === 'esquerda' ? -1 : 1;
  const angulo =
    (o.lado === 'centro' ? tracado.anguloEm(i) : Math.atan2(e.x * paraPista, e.z * paraPista)) + MathUtils.degToRad(o.rotacao ?? 0);

  modelo.position.copy(posicao);
  modelo.rotation.y = angulo;
  modelo.scale.setScalar(o.escala ?? 1);
  cena.add(modelo);

  const info: InfoModelo = MODELOS[o.modelo];
  if (!info.solido) return modelo;
  // Objeto inteiro (pedra, paredão): colisor no formato justo do modelo.
  // Arco (tem vão livre no meio): o casco taparia o vão, então usamos caixas.
  if (info.vaoLivre === undefined) {
    modelo.updateMatrixWorld(true);
    if (fisica.criarCascoFixo(pontosDoModelo(modelo, modelo.matrixWorld))) return modelo;
  }
  criarColisores(fisica, modelo, info.vaoLivre);
  return modelo;
}

/**
 * Caixa(s) do tamanho do objeto. Com `vaoLivre` (arcos), duas caixas, uma em
 * cada ponta do comprimento (Z do modelo), deixando o meio livre.
 */
function criarColisores(fisica: MundoFisico, modelo: Object3D, vaoLivre: number | undefined): void {
  // Mede o modelo "deitado" (sem rotação) para ter a caixa alinhada a ele.
  const angulo = modelo.rotation.y;
  modelo.rotation.y = 0;
  modelo.updateMatrixWorld(true);
  const caixa = new Box3().setFromObject(modelo, true);
  modelo.rotation.y = angulo;
  modelo.updateMatrixWorld(true);

  const tamanho = caixa.getSize(new Vector3());
  const centroLocal = caixa.getCenter(new Vector3()).sub(modelo.position);
  const giro = new Quaternion().setFromAxisAngle(EIXO_Y, angulo);

  const pedacos: { deslocZ: number; meioComprimento: number }[] =
    vaoLivre === undefined
      ? [{ deslocZ: 0, meioComprimento: tamanho.z / 2 }]
      : [-1, 1].map((sinal) => {
          const pilar = (tamanho.z * (1 - vaoLivre)) / 2;
          return { deslocZ: sinal * (tamanho.z / 2 - pilar / 2), meioComprimento: pilar / 2 };
        });

  for (const p of pedacos) {
    const centro = centroLocal.clone().add(new Vector3(0, 0, p.deslocZ)).applyQuaternion(giro).add(modelo.position);
    fisica.criarCaixaFixa(centro, tamanho.x / 2, tamanho.y / 2, p.meioComprimento, giro);
  }
}

/**
 * Fileira de barreiras de concreto atravessando a pista nas duas pontas.
 * Só visual: as paredes invisíveis do ConstrutorPista é que seguram o carro.
 */
export async function barreirasNasPontas(cena: Scene, tracado: Tracado, modeloId: IdModelo): Promise<void> {
  const modelo = await obterModelo(modeloId);
  const comprimento = new Box3().setFromObject(modelo).getSize(new Vector3());
  const passo = Math.max(comprimento.x, comprimento.z);
  const matrizes: Matrix4[] = [];
  for (const [i, recuo] of [[0, 1.5], [tracado.quantidade - 1, -1.5]] as const) {
    const p = tracado.pontos[i];
    const t = tracado.tangentes[i];
    const e = tracado.esquerdas[i];
    // As barreiras ficam de lado (comprimento atravessando a pista).
    const giro = new Quaternion().setFromAxisAngle(EIXO_Y, tracado.anguloEm(i) + Math.PI / 2);
    const meia = tracado.meiaLarguraTotal + 4;
    for (let l = -meia; l <= meia; l += passo) {
      const pos = p.clone().addScaledVector(e, l).addScaledVector(t, -recuo);
      pos.y = tracado.alturaSuperficie(i, Math.max(Math.min(l, tracado.meiaLarguraTotal), -tracado.meiaLarguraTotal));
      matrizes.push(new Matrix4().compose(pos, giro, new Vector3(1, 1, 1)));
    }
  }
  criarInstancias(cena, modelo, matrizes);
}
