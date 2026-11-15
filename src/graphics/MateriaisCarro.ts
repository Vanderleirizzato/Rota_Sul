import { Color, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D } from 'three';
import { CAMADA_BRILHO } from './Camadas';

// Troca os materiais simples que vêm no .glb por materiais PBR caprichados.
//
// PBR ("renderização baseada em física") descreve a superfície com números do
// mundo real: quão metálica ela é e quão áspera. A placa de vídeo calcula o
// brilho a partir disso, e o mesmo material fica certo de manhã, no pôr do
// sol ou à noite.
//
// A lataria ganha "clearcoat": uma segunda camada de verniz transparente por
// cima da tinta, como num carro de verdade. É ela que dá aquele reflexo nítido
// do céu deslizando pela carroceria.

/** Lataria: pouco metálica (metal demais "lava" a cor dos modelos de cor chapada
 *  com o reflexo do céu) e verniz bem liso por cima, que é quem faz o brilho. */
const LATARIA = { metalness: 0.15, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.04 };
/** Pneus: borracha, nada metálica e bem fosca. */
const BORRACHA = { metalness: 0, roughness: 0.9 };
/** Vidros: lisos, refletem o céu. */
const VIDRO = { metalness: 0, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5 };
/** Faróis: emitem luz própria (com o bloom, eles "brilham"). */
const FAROL = { emissiveIntensity: 8 };

export function aplicarMateriaisCarro(modelo: Object3D, rodas: Set<Mesh>): void {
  // Cada material original vira um novo material só uma vez (vários pedaços do
  // carro costumam compartilhar o mesmo material).
  const convertidos = new Map<string, Material>();
  modelo.traverse((obj) => {
    if (!(obj instanceof Mesh) || Array.isArray(obj.material)) return;
    const original = obj.material as Material;
    if (!(original instanceof MeshStandardMaterial)) return;
    // Pneus que não giram (como o estepe do Carro1) também são borracha.
    const eRoda = rodas.has(obj) || /tire|wheel|pneu|roda/i.test(obj.name);
    const chave = `${original.uuid}:${eRoda}`;
    let novo = convertidos.get(chave);
    if (!novo) {
      novo = converter(original, eRoda);
      convertidos.set(chave, novo);
    }
    obj.material = novo;
    // Faróis entram na camada que o bloom faz brilhar (ver PosProcessamento.ts).
    if (novo.userData.brilha === true) obj.layers.enable(CAMADA_BRILHO);
  });
}

function converter(m: MeshStandardMaterial, eRoda: boolean): Material {
  const nome = m.name.toLowerCase();
  // Os dois carros usam uma textura única ("atlas") para carroceria e rodas; o
  // que separa uma da outra é a malha, e não o material.
  if (eRoda) return Object.assign(m.clone(), BORRACHA);
  if (/glass|vidro/.test(nome)) {
    return new MeshPhysicalMaterial({ color: m.color, map: m.map, opacity: m.opacity, transparent: m.transparent, ...VIDRO });
  }
  if (/light|farol/.test(nome)) {
    const farol = m.clone();
    farol.emissive = new Color(0xffffff);
    farol.emissiveMap = m.map;
    farol.emissiveIntensity = FAROL.emissiveIntensity;
    farol.userData.brilha = true;
    return farol;
  }
  // Modelos caprichados (como o Esportivo) trazem uma textura que diz, ponto a
  // ponto, o que é metal/tinta brilhante e o que é fosco (plástico preto,
  // fibra de carbono, grades). Nesse caso usamos a textura do próprio modelo,
  // e o verniz segue o mesmo mapa: brilha na tinta e some nas partes foscas.
  // Sem isso, o verniz cobria o carro inteiro e parecia um plástico-filme.
  if (m.roughnessMap) {
    return new MeshPhysicalMaterial({
      name: `${m.name} (lataria com mapa)`,
      color: m.color,
      map: m.map,
      normalMap: m.normalMap,
      metalness: m.metalness,
      metalnessMap: m.metalnessMap,
      roughness: m.roughness,
      roughnessMap: m.roughnessMap,
      clearcoat: LATARIA.clearcoat,
      clearcoatRoughness: 1,
      clearcoatRoughnessMap: m.roughnessMap,
    });
  }
  return new MeshPhysicalMaterial({
    name: `${m.name} (lataria)`,
    color: m.color,
    map: m.map,
    normalMap: m.normalMap,
    ...LATARIA,
  });
}
