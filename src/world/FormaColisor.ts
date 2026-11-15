import { Matrix4, Vector3, type Mesh, type Object3D } from 'three';

// =============================================================================
// FORMA DO COLISOR: pontos de um modelo para montar um "casco convexo".
// =============================================================================
// Pedra é irregular. Uma caixa (ou cilindro) em volta dela deixa "cantos"
// invisíveis sobrando para fora da pedra, bem na altura da roda: o carro bate
// no nada e capota. O casco convexo é o "embrulho justo" do modelo (como um
// plástico filme esticado em volta): o Rapier calcula a partir dos pontos.
// =============================================================================

/** Acima disto, pulamos pontos: o casco fica igual e o cálculo bem mais rápido. */
const MAXIMO_PONTOS = 800;

/**
 * Pontos de todas as malhas do modelo, já levados por `transformacao`
 * (posição/giro/escala no mundo). Devolve x,y,z em sequência.
 */
export function pontosDoModelo(modelo: Object3D, transformacao: Matrix4): Float32Array {
  modelo.updateMatrixWorld(true);
  // Coordenadas relativas à raiz do modelo, para depois aplicar `transformacao`.
  const paraRaiz = modelo.matrixWorld.clone().invert();
  const malhas: Mesh[] = [];
  modelo.traverse((o) => {
    if ((o as Mesh).isMesh) malhas.push(o as Mesh);
  });
  const total = malhas.reduce((soma, m) => soma + m.geometry.attributes.position.count, 0);
  const pulo = Math.max(1, Math.ceil(total / MAXIMO_PONTOS));

  const saida: number[] = [];
  const v = new Vector3();
  const matriz = new Matrix4();
  for (const malha of malhas) {
    matriz.multiplyMatrices(paraRaiz, malha.matrixWorld).premultiply(transformacao);
    const posicoes = malha.geometry.attributes.position;
    for (let k = 0; k < posicoes.count; k += pulo) {
      v.fromBufferAttribute(posicoes, k).applyMatrix4(matriz);
      saida.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(saida);
}
