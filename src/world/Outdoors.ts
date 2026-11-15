import { Box3, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, type Material, type Scene } from 'three';
import { criarArte } from '../graphics/ArteOutdoor';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type InfoModelo } from './assets';
import type { OutdoorFase } from './levels/TiposFase';
import { colocarObjeto } from './ObjetosFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// OUTDOORS
// =============================================================================
// O modelo 3D é só a estrutura (pernas e placa cinza). A arte é um retângulo
// novo, colado na frente da placa, com a textura pintada em ArteOutdoor.ts.
//
// Onde fica a placa? Em vez de medir à mão, procuramos dentro do modelo a
// malha com o material da placa (`materialPainel` no manifesto) e medimos a
// caixa dela. Se trocar o modelo do outdoor, basta dizer o material novo.
// =============================================================================

/** Afastamento (m) da arte em relação à placa: sem ele, as duas "brigam" e piscam. */
const FOLGA = 0.03;
/** A arte cobre esta fração da placa (sobra uma moldura em volta). */
const MARGEM = 0.94;
/** Quanto (graus) o outdoor gira para encarar quem vem pela estrada. 0 = de frente para o
 *  meio da pista; 90 = olhando direto para quem vem (de lado para a pista). */
const ANGULO_PARA_QUEM_VEM = 55;

export async function colocarOutdoors(cena: Scene, fisica: MundoFisico, tracado: Tracado, terreno: Terreno, outdoors: OutdoorFase[]): Promise<void> {
  await Promise.all(outdoors.map((o) => colocarOutdoor(cena, fisica, tracado, terreno, o)));
}

async function colocarOutdoor(cena: Scene, fisica: MundoFisico, tracado: Tracado, terreno: Terreno, o: OutdoorFase): Promise<void> {
  // De frente para a pista, quem dirige só veria o outdoor de lado, no último
  // instante. Girado na direção de quem vem, ele fica legível de longe.
  // (O sinal muda com o lado: dos dois lados, ele vira para trás na pista.)
  const giro = (o.lado === 'esquerda' ? -1 : 1) * ANGULO_PARA_QUEM_VEM;
  const modelo = await colocarObjeto(cena, fisica, tracado, terreno, {
    modelo: 'outdoor',
    distancia: o.distancia,
    lado: o.lado,
    afastamento: o.afastamento,
    rotacao: giro + (o.rotacao ?? 0),
  });
  const info: InfoModelo = MODELOS.outdoor;

  // Acha a placa e mede a caixa dela no espaço do próprio modelo (sem a
  // posição e o giro na fase), onde a frente do outdoor é o +Z.
  modelo.updateMatrixWorld(true);
  const paraModelo = new Matrix4().copy(modelo.matrixWorld).invert();
  const caixa = new Box3();
  modelo.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const material = obj.material as Material;
    if (material.name !== info.materialPainel) return;
    obj.geometry.computeBoundingBox();
    const b = obj.geometry.boundingBox;
    if (b) caixa.union(b.clone().applyMatrix4(new Matrix4().multiplyMatrices(paraModelo, obj.matrixWorld)));
  });
  if (caixa.isEmpty()) {
    console.warn(`Outdoor: material "${info.materialPainel}" não encontrado no modelo; a arte ficou de fora.`);
    return;
  }

  const largura = (caixa.max.x - caixa.min.x) * MARGEM;
  const altura = (caixa.max.y - caixa.min.y) * MARGEM;
  // A arte "brilha" um pouco sozinha (emissive), como outdoor iluminado:
  // fica legível mesmo contra o sol, no pôr do sol da Fase 2.
  const textura = criarArte(o.arte);
  const material = new MeshStandardMaterial({ map: textura, emissive: 0xffffff, emissiveMap: textura, emissiveIntensity: 0.35, roughness: 0.6 });
  const arte = new Mesh(new PlaneGeometry(largura, altura), material);
  arte.position.set((caixa.min.x + caixa.max.x) / 2, (caixa.min.y + caixa.max.y) / 2, caixa.max.z + FOLGA);
  arte.castShadow = false;
  arte.receiveShadow = true;
  modelo.add(arte);
}
