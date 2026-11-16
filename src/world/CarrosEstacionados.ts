import { Matrix4, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import type { CarroDisponivel, EstadoCarro } from './Cenario';
import { CARRO_JOGADOR } from './ContatoCarro';
import type { LugarInstancia } from './Instancias';

// =============================================================================
// CARROS ESTACIONADOS NOS BAIRROS
// =============================================================================
// São muitos (dezenas por bairro), então ficam baratos enquanto ninguém mexe:
// cópias de um InstancedMesh com uma caixa FIXA na física.
//
// Só que caixa fixa é um muro: bater a 100 km/h num carro parado não pode
// parecer bater numa pedra. Então fazemos o mesmo truque do trânsito
// (VeiculoTrafego.soltar) e dos postes: um instante ANTES da batida, a caixa
// fixa sai e entra um corpo DINÂMICO com peso de carro, e a cópia instanciada
// dá lugar a um modelo avulso que acompanha a física. A batida de verdade
// decide o resto: o carro parado é empurrado, gira, pode até capotar.
//
// E o jogador pode pegar qualquer um deles (parado ou já empurrado) para
// dirigir: ver disponivel().
// =============================================================================

/** Matriz que "encolhe a zero": esconde uma cópia de um InstancedMesh. */
const SUMIR = new Matrix4().makeScale(0, 0, 0);
/** Só testa carros a menos disto (m) de quem pode bater neles. */
const PERTO = 12;
/** Abaixo desta velocidade (m/s) o jogador só encosta: o carro parado continua firme. */
const VELOCIDADE_SOLTAR = 1.5;
/** Margem (m) para "vai bater": um pouco antes do contato de verdade. */
const MARGEM_CONTATO = 0.3;
/** Do meio do carro até a lataria (m), para medir a distância até a porta. */
const ATE_A_LATARIA = 2;

/** Um carro estacionado. */
export interface Estacionado {
  modelo: IdModelo;
  /** Onde ele foi estacionado (no chão, embaixo do meio do carro) e o giro. */
  posicao: Vector3;
  giro: Quaternion;
  /** Metade de cada medida (m): largura, altura e comprimento. */
  meias: Vector3;
  /** Posição, giro e escala da cópia instanciada (para devolvê-la com a tecla T). */
  matriz: Matrix4;
  colisor: RAPIER.Collider | null;
  /** Onde estão os pedaços dele nas malhas instanciadas. */
  lugares: LugarInstancia[];
  /** Já levou uma batida: agora é um corpo dinâmico com um modelo avulso. */
  solto: { objeto: Object3D; corpo: RAPIER.RigidBody } | null;
  /** O jogador pegou para dirigir: sumiu daqui. */
  pego: boolean;
}

export class CarrosEstacionados {
  private impacto = 0;
  private readonly futuro = new Vector3();
  private readonly local = new Vector3();
  private readonly inversa = new Quaternion();

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly lista: Estacionado[],
    /** Os modelos, para criar a cópia avulsa quando um carro é solto. */
    private readonly modelos: Map<IdModelo, Object3D>,
  ) {}

  /** Um passo de física: solta o carro em que o jogador (ou um carro já solto) vai bater. */
  passo(dt: number, carro: EstadoCarro): void {
    const rapidez = carro.velocidade.length();
    const futuro = this.futuro.copy(carro.posicao).addScaledVector(carro.velocidade, dt);
    for (const e of this.lista) {
      if (e.solto || e.pego) continue;
      if (rapidez > VELOCIDADE_SOLTAR && this.perto(e, carro.posicao)) {
        const margem = MARGEM_CONTATO + rapidez * dt;
        if (this.encosta(e, futuro, CARRO_JOGADOR.meiaLargura + margem, CARRO_JOGADOR.meioComprimento + margem)) {
          this.soltar(e, rapidez);
          continue;
        }
      }
      // Engavetamento: um carro já solto, ainda andando, empurra o próximo.
      for (const outro of this.lista) {
        if (!outro.solto || outro === e) continue;
        const v = outro.solto.corpo.linvel();
        if (Math.hypot(v.x, v.z) < VELOCIDADE_SOLTAR) continue;
        const p = outro.solto.corpo.translation();
        this.futuro.set(p.x, p.y, p.z);
        if (this.perto(e, this.futuro) && this.encosta(e, this.futuro, outro.meias.x + MARGEM_CONTATO, outro.meias.z + MARGEM_CONTATO)) {
          this.soltar(e, Math.hypot(v.x, v.z));
          break;
        }
      }
      futuro.copy(carro.posicao).addScaledVector(carro.velocidade, dt);
    }
  }

  /** A cada quadro: o desenho dos carros soltos acompanha a física. */
  atualizar(): void {
    for (const e of this.lista) {
      if (!e.solto || e.solto.corpo.isSleeping()) continue;
      const t = e.solto.corpo.translation();
      const r = e.solto.corpo.rotation();
      e.solto.objeto.position.set(t.x, t.y, t.z);
      e.solto.objeto.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Corrida reiniciada (tecla T): os carros empurrados voltam para a vaga. */
  reiniciar(): void {
    for (const e of this.lista) {
      if (!e.solto || e.pego) continue;
      this.cena.remove(e.solto.objeto);
      this.fisica.remover(e.solto.corpo);
      e.solto = null;
      this.mostrarCopia(e, e.matriz);
      e.colisor = this.criarFixo(e);
    }
  }

  /** A batida mais forte em carros parados desde a última consulta (0 a 1). */
  colherImpacto(): number {
    const valor = this.impacto;
    this.impacto = 0;
    return valor;
  }

  /** O carro estacionado (ou empurrado) mais perto de `p` que dá para dirigir. */
  disponivel(p: Vector3, raio: number): CarroDisponivel | null {
    let melhor: Estacionado | null = null;
    let menor = raio;
    for (const e of this.lista) {
      const info: InfoModelo = MODELOS[e.modelo];
      if (e.pego || !info.rodas) continue;
      const d = Math.max(0, this.onde(e).posicao.distanceTo(p) - ATE_A_LATARIA);
      if (d <= menor) {
        menor = d;
        melhor = e;
      }
    }
    if (!melhor) return null;
    const e = melhor;
    const { posicao, angulo } = this.onde(e);
    return { modelo: e.modelo, posicao, angulo, distancia: menor, pegar: () => this.pegar(e) };
  }

  // ---------------------------------------------------------------------------

  /** Onde o carro está agora: na vaga, ou onde a batida o deixou. */
  private onde(e: Estacionado): { posicao: Vector3; angulo: number } {
    if (!e.solto) {
      const frente = new Vector3(0, 0, 1).applyQuaternion(e.giro);
      return { posicao: e.posicao.clone(), angulo: Math.atan2(frente.x, frente.z) };
    }
    const t = e.solto.corpo.translation();
    const r = e.solto.corpo.rotation();
    const frente = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
    return { posicao: new Vector3(t.x, t.y, t.z), angulo: Math.atan2(frente.x, frente.z) };
  }

  private pegar(e: Estacionado): void {
    if (e.pego) return;
    e.pego = true;
    if (e.colisor) this.fisica.removerColisor(e.colisor);
    e.colisor = null;
    if (e.solto) {
      this.cena.remove(e.solto.objeto);
      this.fisica.remover(e.solto.corpo);
      e.solto = null;
    }
    this.mostrarCopia(e, SUMIR);
  }

  /** Vira corpo dinâmico com peso de carro (o mesmo cálculo do trânsito). */
  private soltar(e: Estacionado, rapidez: number): void {
    if (e.colisor) this.fisica.removerColisor(e.colisor);
    e.colisor = null;
    this.mostrarCopia(e, SUMIR);

    const objeto = this.modelos.get(e.modelo)!.clone();
    objeto.position.copy(e.posicao);
    objeto.quaternion.copy(e.giro);
    this.cena.add(objeto);
    const corpo = this.fisica.criarVeiculoCinematico(e.meias);
    corpo.setTranslation(e.posicao, true);
    corpo.setRotation(e.giro, true);
    const t = tuning.trafego;
    const volume = 8 * e.meias.x * e.meias.y * e.meias.z;
    this.fisica.soltarVeiculo(corpo, volume * t.densidade, t.atritoAposBatida, t.arrastoAposBatida, { x: 0, y: 0, z: 0 });
    e.solto = { objeto, corpo };
    this.impacto = Math.max(this.impacto, Math.min(rapidez / 30, 1));
  }

  private criarFixo(e: Estacionado): RAPIER.Collider {
    return this.fisica.criarCaixaFixa({ x: e.posicao.x, y: e.posicao.y + e.meias.y, z: e.posicao.z }, e.meias.x, e.meias.y, e.meias.z, e.giro);
  }

  private mostrarCopia(e: Estacionado, matriz: Matrix4): void {
    for (const { malha, indice } of e.lugares) {
      malha.setMatrixAt(indice, matriz);
      malha.instanceMatrix.needsUpdate = true;
    }
  }

  /** Conta rápida (só distância), antes da conta exata de encostar. */
  private perto(e: Estacionado, p: Vector3): boolean {
    const dx = e.posicao.x - p.x;
    const dz = e.posicao.z - p.z;
    return dx * dx + dz * dz < PERTO * PERTO;
  }

  /**
   * O ponto `p` (o centro de quem vem) está a ponto de encostar no carro?
   * Medido nos eixos do carro parado: largura em X, comprimento em Z.
   */
  private encosta(e: Estacionado, p: Vector3, folgaLado: number, folgaFrente: number): boolean {
    const l = this.local.copy(p).sub(e.posicao).applyQuaternion(this.inversa.copy(e.giro).invert());
    return Math.abs(l.x) < e.meias.x + folgaLado && Math.abs(l.z) < e.meias.z + folgaFrente && Math.abs(l.y - e.meias.y) < e.meias.y + 1.5;
  }
}
