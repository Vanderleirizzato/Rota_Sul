import { Box3, MathUtils, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { tuning } from '../config/tuning';
import type { MundoFisico } from '../physics/MundoFisico';
import { obterModelo } from './CarregadorModelos';
import type { GrupoSoltos } from './levels/TiposFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// OBJETOS SOLTOS: cones e barreiras de plástico que voam na batida.
// =============================================================================
// São corpos DINÂMICOS (a física move) e bem leves: o carro de 1200 kg mal
// sente a batida, e o cone de 3 kg sai voando. Parados, eles "dormem" no
// Rapier e não custam nada; só acordam quando alguém encosta.
// =============================================================================

/** Além desta distância (m) da câmera, o desenho é escondido. */
const DISTANCIA_VER = 250;
/** Velocidade (m/s) a partir da qual um objeto parado "levou uma batida". */
const VELOCIDADE_ACERTO = 2;
/** Velocidade (m/s) do objeto arremessado que conta como batida máxima (som no máximo). */
const VELOCIDADE_ACERTO_FORTE = 15;
/** Caiu este tanto (m) abaixo de onde estava (rolou barranco abaixo, caiu no mar): volta quando ninguém estiver olhando. */
const QUEDA_PARA_VOLTAR = 15;
const EIXO_Y = new Vector3(0, 1, 0);

interface Solto {
  corpo: RAPIER.RigidBody;
  objeto: Object3D;
  /** Do centro do colisor até a base do desenho (m). */
  meiaAltura: number;
  origem: Vector3;
  giroOrigem: Quaternion;
  /** Velocidade no quadro anterior, para perceber o "pulo" de uma batida. */
  velocidadeAntes: number;
}

export class ObjetosSoltos {
  private readonly soltos: Solto[] = [];
  /** A batida mais forte em objetos soltos desde a última consulta (0 a 1). */
  private impacto = 0;

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly terreno: Terreno,
    private readonly grupos: readonly GrupoSoltos[],
  ) {}

  async carregar(): Promise<void> {
    for (const g of this.grupos) {
      const modelo = await obterModelo(g.modelo);
      const tamanho = new Box3().setFromObject(modelo).getSize(new Vector3());
      const sinal = g.lado === 'esquerda' ? 1 : -1;
      for (let d = g.inicio; d <= g.fim; d += g.espacamento) {
        const lateral = sinal * g.afastamento;
        const base = this.tracado.posicaoEm(d, lateral);
        // Fora do asfalto, a altura vem do terreno.
        if (g.afastamento > this.tracado.meiaLarguraTotal) base.y = this.terreno.alturaEm(base.x, base.z);
        const e = this.tracado.esquerdas[this.tracado.indiceEm(d)];
        const angulo = Math.atan2(-sinal * e.x, -sinal * e.z) + MathUtils.degToRad(g.rotacao ?? 0);
        const giro = new Quaternion().setFromAxisAngle(EIXO_Y, angulo);
        const meiaAltura = tamanho.y / 2;
        const centro = base.clone().setY(base.y + meiaAltura + 0.02);
        const forma =
          g.modelo === 'cone'
            ? { tipo: 'cone' as const, raio: Math.max(tamanho.x, tamanho.z) / 2, meiaAltura }
            : { tipo: 'caixa' as const, meias: { x: tamanho.x / 2, y: meiaAltura, z: tamanho.z / 2 } };
        const massa = g.modelo === 'cone' ? tuning.objetosSoltos.massaCone : tuning.objetosSoltos.massaBarreiraPlastica;
        const corpo = this.fisica.criarSolto(forma, centro, giro, massa);
        // clone() compartilha a geometria: 50 cones custam a memória de um.
        const objeto = modelo.clone();
        this.cena.add(objeto);
        const solto: Solto = { corpo, objeto, meiaAltura, origem: centro, giroOrigem: giro, velocidadeAntes: 0 };
        this.copiarFisica(solto);
        this.soltos.push(solto);
      }
    }
  }

  /** Copia a física para o desenho e percebe as batidas. Chamado a cada quadro. */
  atualizar(posicaoCamera: Vector3): void {
    for (const s of this.soltos) {
      const longe = s.objeto.position.distanceTo(posicaoCamera) > DISTANCIA_VER;
      s.objeto.visible = !longe;
      if (s.corpo.isSleeping()) {
        s.velocidadeAntes = 0;
        continue;
      }
      const v = s.corpo.linvel();
      const velocidade = Math.hypot(v.x, v.y, v.z);
      // Estava quase parado e de repente está rápido: levou uma batida.
      if (s.velocidadeAntes < VELOCIDADE_ACERTO / 2 && velocidade > VELOCIDADE_ACERTO) {
        this.impacto = Math.max(this.impacto, Math.min(velocidade / VELOCIDADE_ACERTO_FORTE, 1));
      }
      s.velocidadeAntes = velocidade;
      if (s.corpo.translation().y < s.origem.y - QUEDA_PARA_VOLTAR && longe) this.devolver(s);
      this.copiarFisica(s);
    }
  }

  /** Lê e zera a batida mais forte desde a última vez (0 = nenhuma). */
  colherImpacto(): number {
    const valor = this.impacto;
    this.impacto = 0;
    return valor;
  }

  /** Corrida reiniciada (tecla T): tudo volta para o lugar. */
  reiniciar(): void {
    for (const s of this.soltos) this.devolver(s);
  }

  private devolver(s: Solto): void {
    s.corpo.setTranslation(s.origem, false);
    s.corpo.setRotation(s.giroOrigem, false);
    s.corpo.setLinvel({ x: 0, y: 0, z: 0 }, false);
    s.corpo.setAngvel({ x: 0, y: 0, z: 0 }, false);
    s.corpo.sleep();
    s.velocidadeAntes = 0;
    this.copiarFisica(s);
  }

  /** O colisor tem a origem no meio do objeto; o desenho, na base. */
  private copiarFisica(s: Solto): void {
    const p = s.corpo.translation();
    const r = s.corpo.rotation();
    s.objeto.quaternion.set(r.x, r.y, r.z, r.w);
    s.objeto.position.set(0, -s.meiaAltura, 0).applyQuaternion(s.objeto.quaternion).add(p);
  }
}
