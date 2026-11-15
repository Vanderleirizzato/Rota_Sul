import { Matrix4, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';
import type { MundoFisico } from '../physics/MundoFisico';
import type { EstadoCarro } from './Cenario';
import { carroAlcanca } from './ContatoCarro';
import type { LugarInstancia } from './Instancias';

// =============================================================================
// POSTES DERRUBÁVEIS
// =============================================================================
// Os postes são desenhados aos montes de uma vez (InstancedMesh) e têm um
// cilindro FIXO na física (um muro: o carro devagar só encosta).
//
// Quando o carro vem rápido para cima de um, um instante ANTES do contato:
//  1) o cilindro fixo sai da física e entra no lugar um cilindro DINÂMICO,
//     com peso de poste. A batida acontece de verdade: o carro empurra o
//     poste, perde um pouco de velocidade, e o poste tomba pelo próprio peso
//     (uma vara alta começa a cair devagar e vai acelerando);
//  2) a cópia instanciada é escondida, e um poste "avulso" é desenhado
//     acompanhando o corpo da física.
// Por que não só animar a queda? Porque o carro passaria "por dentro" do
// poste enquanto ele ainda está quase em pé.
// =============================================================================

/** Matriz que "encolhe a zero": esconde uma cópia de um InstancedMesh. */
const SUMIR = new Matrix4().makeScale(0, 0, 0);
const CIMA = new Vector3(0, 1, 0);
/** Só testa postes a menos disto (m) do carro (conta rápida, antes da conta exata). */
const PERTO = 8;
/** O poste solto sai com esta fração da velocidade do carro (o resto vem da batida). */
const FRACAO_VELOCIDADE = 0.3;

export interface PosteDerrubavel {
  /** O modelo, para criar a cópia avulsa que tomba. */
  modelo: Object3D;
  /** Posição, giro e escala do poste (a mesma da cópia instanciada). */
  matriz: Matrix4;
  /** Pé do poste, no chão. */
  base: Vector3;
  altura: number;
  raio: number;
  colisor: RAPIER.Collider;
  /** Onde estão os pedaços dele nas malhas instanciadas. */
  pedacos: LugarInstancia[];
  /** A bolinha acesa da lâmpada (se tiver) e onde ela fica. */
  lampada: LugarInstancia | null;
  posicaoLampada: Vector3;
}

interface PosteCaido {
  poste: PosteDerrubavel;
  objeto: Object3D;
  corpo: RAPIER.RigidBody;
}

export class Postes {
  private readonly emPe: PosteDerrubavel[] = [];
  /** Os que já foram derrubados, para voltarem com a tecla T. */
  private readonly caidos: PosteCaido[] = [];
  private impacto = 0;
  private readonly centro = new Vector3();
  private readonly giro = new Quaternion();

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
  ) {}

  adicionar(poste: PosteDerrubavel): void {
    this.emPe.push(poste);
  }

  /** Um passo de física: solta o poste em que o carro vai bater. */
  passo(dt: number, carro: EstadoCarro): void {
    const rapidez = carro.velocidade.length();
    if (rapidez < tuning.postes.velocidadeDerrubar / 3.6) return;
    for (let k = this.emPe.length - 1; k >= 0; k--) {
      const p = this.emPe[k];
      const dx = p.base.x - carro.posicao.x;
      const dz = p.base.z - carro.posicao.z;
      if (dx * dx + dz * dz > PERTO * PERTO) continue;
      // O meio do tronco, na altura do para-choque.
      this.centro.copy(p.base).setY(p.base.y + 0.8);
      if (!carroAlcanca(carro, this.centro, p.raio, dt * 2)) continue;
      this.soltar(p, carro, rapidez);
      this.emPe.splice(k, 1);
    }
  }

  /** A cada quadro: o desenho dos postes caídos acompanha a física. */
  atualizar(): void {
    for (const c of this.caidos) {
      if (c.corpo.isSleeping()) continue;
      const t = c.corpo.translation();
      const r = c.corpo.rotation();
      this.giro.set(r.x, r.y, r.z, r.w);
      c.objeto.quaternion.copy(this.giro);
      // O corpo tem o centro no meio do poste; o desenho, no pé.
      c.objeto.position.set(0, -c.poste.altura / 2, 0).applyQuaternion(this.giro).add(t);
    }
  }

  /** Corrida reiniciada (tecla T): todo poste derrubado volta a ficar em pé. */
  reiniciar(): void {
    for (const c of this.caidos) {
      const p = c.poste;
      this.cena.remove(c.objeto);
      this.fisica.remover(c.corpo);
      for (const { malha, indice } of p.pedacos) {
        malha.setMatrixAt(indice, p.matriz);
        malha.instanceMatrix.needsUpdate = true;
      }
      if (p.lampada) {
        p.lampada.malha.setMatrixAt(p.lampada.indice, new Matrix4().makeTranslation(p.posicaoLampada));
        p.lampada.malha.instanceMatrix.needsUpdate = true;
      }
      // O colisor fixo antigo foi apagado da física: cria um igual.
      p.colisor = this.fisica.criarCilindroFixo({ x: p.base.x, y: p.base.y + p.altura / 2, z: p.base.z }, p.raio, p.altura / 2);
      this.emPe.push(p);
    }
    this.caidos.length = 0;
  }

  /** A batida mais forte em postes desde a última consulta (0 a 1). */
  colherImpacto(): number {
    const valor = this.impacto;
    this.impacto = 0;
    return valor;
  }

  private soltar(p: PosteDerrubavel, carro: EstadoCarro, rapidez: number): void {
    // Some o poste fixo (desenho e colisor)...
    this.fisica.removerColisor(p.colisor);
    for (const { malha, indice } of p.pedacos) {
      malha.setMatrixAt(indice, SUMIR);
      malha.instanceMatrix.needsUpdate = true;
    }
    if (p.lampada) {
      p.lampada.malha.setMatrixAt(p.lampada.indice, SUMIR);
      p.lampada.malha.instanceMatrix.needsUpdate = true;
    }

    // ...e entra um poste solto, no mesmo lugar.
    const objeto = p.modelo.clone();
    p.matriz.decompose(objeto.position, objeto.quaternion, objeto.scale);
    this.cena.add(objeto);
    const centro = p.base.clone().setY(p.base.y + p.altura / 2);
    const corpo = this.fisica.criarSolto({ tipo: 'cilindro', raio: p.raio, meiaAltura: p.altura / 2 }, centro, objeto.quaternion, tuning.postes.massa);
    corpo.wakeUp();
    // Já sai andando um pouco e inclinando para longe do carro: o resto
    // (quanto ele voa, para onde cai) a batida de verdade decide.
    const direcao = carro.velocidade.clone().setY(0).normalize();
    corpo.setLinvel(direcao.clone().multiplyScalar(rapidez * FRACAO_VELOCIDADE), true);
    corpo.setAngvel(new Vector3().crossVectors(CIMA, direcao).multiplyScalar(rapidez * tuning.postes.empurrao), true);
    this.caidos.push({ poste: p, objeto, corpo });
    this.impacto = Math.max(this.impacto, Math.min(rapidez / 30, 1));
  }
}
