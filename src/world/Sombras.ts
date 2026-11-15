import type { Object3D } from 'three';

/** Liga ou desliga a sombra projetada por todas as malhas de um modelo. */
export function ligarSombra(objeto: Object3D, ligada: boolean): void {
  objeto.traverse((filho) => {
    filho.castShadow = ligada;
  });
}
