import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2, type Scene, type Texture } from 'three';
import { texturaOndas } from '../graphics/Texturas';
import type { DadosMar } from './levels/TiposFase';
import type { Tracado } from './Tracado';

// =============================================================================
// MAR: um plano de água enorme, na altura `nivel`, com ondas que se mexem.
// =============================================================================
// Por que não uma "água com reflexo de verdade" (que desenha a cena de novo,
// vista de baixo, a cada quadro)? Ela dobraria o trabalho da placa de vídeo,
// e a meta é 60 fps em vídeo integrado. Este mar é um material PBR liso
// (pouca rugosidade) com um normal map de ondas:
//   - o SOL vira um rastro brilhante na água (reflexo especular do sol em
//     cada ondinha), mais forte no pôr do sol, com o sol baixo à frente;
//   - o CÉU aparece refletido (o mapa de ambiente que o Ceu.ts gera), mais
//     forte quanto mais de lado olhamos a água, como no mar de verdade.
//
// O plano passa por baixo de toda a fase. Em terra, o terreno fica acima da
// água e o esconde; do lado do mar, a areia desce e mergulha nele.
// =============================================================================

/** Lado do plano de água (m). Grande o bastante para chegar ao horizonte. */
const TAMANHO = 9000;
/** Uma "telha" da textura de ondas cobre este tanto (m). Menor: ondas menores. */
const TAMANHO_ONDA = 28;
/** Velocidade (m/s) com que as ondas andam, em X e em Z. */
const CORRENTEZA = new Vector2(0.35, 0.6);
/** Força do relevo das ondas. Mais alto: mar mais agitado, rastro do sol mais espalhado. */
const FORCA_ONDAS = 0.55;
/** Rugosidade da água: mais baixo, reflexo do sol mais fino e brilhante. */
const RUGOSIDADE = 0.14;

export class Mar {
  private readonly ondas: Texture;

  constructor(cena: Scene, tracado: Tracado, dados: DadosMar) {
    this.ondas = texturaOndas();
    this.ondas.repeat.set(TAMANHO / TAMANHO_ONDA, TAMANHO / TAMANHO_ONDA);

    const agua = new Mesh(
      // O plano nasce "em pé" (XY); deitamos para ficar no chão (XZ).
      new PlaneGeometry(TAMANHO, TAMANHO).rotateX(-Math.PI / 2),
      new MeshStandardMaterial({
        color: new Color(dados.corAgua),
        roughness: RUGOSIDADE,
        metalness: 0,
        normalMap: this.ondas,
        normalScale: new Vector2(FORCA_ONDAS, FORCA_ONDAS),
      }),
    );
    // Centro do plano: o meio da pista. Ele é tão grande que cobre tudo.
    const meio = tracado.pontos[Math.floor((tracado.indicePrimeiro + tracado.indiceUltimo) / 2)];
    agua.position.set(meio.x, dados.nivel, meio.z);
    // A água recebe sombra (dos navios, do píer), mas não projeta.
    agua.receiveShadow = true;
    cena.add(agua);
  }

  /** As ondas andam: deslocamos a textura um pouco a cada quadro. */
  atualizar(dt: number): void {
    this.ondas.offset.x = (this.ondas.offset.x + (CORRENTEZA.x * dt) / TAMANHO_ONDA) % 1;
    this.ondas.offset.y = (this.ondas.offset.y + (CORRENTEZA.y * dt) / TAMANHO_ONDA) % 1;
  }
}
