import type { AnimacoesAPe } from '../world/assets';
import { AnimationMixer, LoopOnce, type AnimationAction, type AnimationClip, type Object3D } from 'three';

// =============================================================================
// O DESENHO DO PERSONAGEM: o modelo escolhido no menu e suas animações
// =============================================================================
// O AnimationMixer é o "tocador" de animações do three.js. Cada animação vira
// uma "ação" com um PESO de 0 a 1. Em vez de trocar de uma animação para a
// outra de uma vez (o boneco daria um tranco), deixamos várias tocando ao
// mesmo tempo e só mudamos os pesos aos poucos: parado → andando → correndo
// se misturam suavemente.
// =============================================================================

export type PoseAPe = keyof AnimacoesAPe;


/** Rapidez (por segundo) com que uma pose dá lugar à outra. 8 ≈ um oitavo de segundo. */
const RAPIDEZ_MISTURA = 8;
/**
 * Velocidade (m/s) em que a animação de andar/correr "casa" com o chão, sem o
 * pé patinar. Andando mais rápido, a animação toca mais rápido junto.
 */
const PASSO_ANDAR = 1.6;
const PASSO_CORRER = 5;

export class PersonagemVisual {
  private readonly mixer: AnimationMixer;
  private readonly acoes = new Map<PoseAPe, AnimationAction>();
  private readonly pesos = new Map<PoseAPe, number>();

  constructor(
    readonly objeto: Object3D,
    animacoes: AnimationClip[],
    /** O nome de cada pose no arquivo deste personagem (ver PERSONAGENS em assets.ts). */
    nomes: AnimacoesAPe,
  ) {
    this.mixer = new AnimationMixer(objeto);
    for (const pose of Object.keys(nomes) as PoseAPe[]) {
      // Nome exato depois do "|": "Idle" não pode pegar "SitIdle" por engano.
      const nome = nomes[pose];
      const clipe = animacoes.find((a) => a.name.split('|').pop() === nome);
      if (!clipe) {
        console.warn(`Personagem: animação ${nome} não encontrada no modelo.`);
        continue;
      }
      const acao = this.mixer.clipAction(clipe);
      if (pose === 'pulando') {
        // O pulo toca uma vez e fica no último quadro enquanto ele estiver no ar.
        acao.setLoop(LoopOnce, 1);
        acao.clampWhenFinished = true;
      }
      acao.setEffectiveWeight(0).play();
      this.acoes.set(pose, acao);
      this.pesos.set(pose, 0);
    }
    objeto.visible = false;
  }

  mostrar(visivel: boolean): void {
    this.objeto.visible = visivel;
  }

  /**
   * A cada quadro. `pe` = onde fica a sola do pé; `angulo` = para onde olha;
   * `rapidez` = velocidade horizontal real (m/s), que acerta o ritmo dos passos.
   */
  atualizar(dt: number, pe: { x: number; y: number; z: number }, angulo: number, pose: PoseAPe, rapidez: number): void {
    // Sem animação de pulo (alguns modelos não têm): no ar, ele "corre".
    if (!this.acoes.has(pose)) pose = 'correndo';
    this.objeto.position.set(pe.x, pe.y, pe.z);
    this.objeto.rotation.y = angulo;

    const pulo = this.acoes.get('pulando');
    // Acabou de sair do chão: o pulo começa do início.
    if (pulo && pose === 'pulando' && (this.pesos.get('pulando') ?? 0) < 0.05) pulo.reset().play();

    const mistura = 1 - Math.exp(-RAPIDEZ_MISTURA * dt);
    for (const [p, acao] of this.acoes) {
      const atual = this.pesos.get(p) ?? 0;
      const peso = atual + ((p === pose ? 1 : 0) - atual) * mistura;
      this.pesos.set(p, peso);
      acao.setEffectiveWeight(peso);
    }
    this.acoes.get('andando')?.setEffectiveTimeScale(Math.max(rapidez / PASSO_ANDAR, 0.5));
    this.acoes.get('correndo')?.setEffectiveTimeScale(Math.max(rapidez / PASSO_CORRER, 0.5));
    this.mixer.update(dt);
  }
}
