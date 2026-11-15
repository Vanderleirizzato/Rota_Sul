import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, type Scene } from 'three';
import { CENTRO_ATE_PE, PersonagemFisico, type ComandosAPe } from '../physics/PersonagemFisico';
import { PersonagemVisual, type PoseAPe } from '../graphics/PersonagemVisual';
import { obterAnimacoes, obterModelo } from '../world/CarregadorModelos';
import { PERSONAGENS, type IdPersonagem } from '../world/assets';

// =============================================================================
// O PERSONAGEM: desce do carro (tecla E), anda pelo mapa e volta para ele
// =============================================================================
// Junta a física (PersonagemFisico) e o desenho (PersonagemVisual), como o
// carro junta VeiculoFisico e CarroVisual. As regras de QUANDO pode descer
// (só passeando, carro parado) ficam no Jogo; aqui fica o COMO.
// =============================================================================

/** Abaixo disto (m/s), conta como parado (a animação não fica "andando" no lugar). */
const QUASE_PARADO = 0.25;
/** Acima disto (m/s), a animação é a de correr. */
const LIMITE_CORRER = 3.2;
/** Folga (m) entre a lateral do carro e o personagem quando ele desce. */
const FOLGA_PORTA = 0.7;
/** Espaço extra (m) além do ponto de descida: o corpo do personagem também precisa caber. */
const RAIO_FOLGA = 0.4;

export class Personagem {
  /** Fora do carro? (dentro, ele some e não existe para a física) */
  ativo = false;
  /** Posição dos pés no quadro (interpolada entre os passos de física). */
  readonly pe = new Vector3();
  /** Ângulo no quadro (interpolado). */
  angulo = 0;

  private constructor(
    private readonly fisico: PersonagemFisico,
    private readonly visual: PersonagemVisual,
    private readonly mundo: RAPIER.World,
  ) {}

  /** `id`: quem foi escolhido no menu (ver PERSONAGENS em assets.ts). */
  static async criar(cena: Scene, mundo: RAPIER.World, id: IdPersonagem): Promise<Personagem> {
    const [modelo, animacoes] = await Promise.all([obterModelo(id), obterAnimacoes(id)]);
    cena.add(modelo);
    return new Personagem(new PersonagemFisico(mundo), new PersonagemVisual(modelo, animacoes, PERSONAGENS[id].animacoes), mundo);
  }

  /** Centro do corpo (m), no passo de física atual: para medir distâncias. */
  get centro(): Vector3 {
    return this.fisico.posicaoAtual;
  }

  get anguloAtual(): number {
    return this.fisico.angulo;
  }

  /** Velocidade (m/s) em x, y e z: o cenário usa para o trânsito frear. */
  get velocidade(): Vector3 {
    return this.fisico.velocidade;
  }

  /**
   * Desce pela porta do motorista (lado esquerdo). Se ali tem parede, muro ou
   * outro carro, desce pela direita. `corpoCarro` fica fora do teste (senão
   * o próprio carro "bloquearia" as duas portas).
   */
  descer(posCarro: Vector3, anguloCarro: number, meiaLarguraCarro: number, corpoCarro: RAPIER.RigidBody): void {
    // A esquerda de quem olha para +Z é o +X (o mesmo sentido do ângulo do carro).
    const esquerda = new Vector3(Math.cos(anguloCarro), 0, -Math.sin(anguloCarro));
    const distancia = meiaLarguraCarro + FOLGA_PORTA;
    let lado = esquerda;
    if (this.bloqueado(posCarro, esquerda, distancia, corpoCarro)) lado = esquerda.clone().negate();
    this.aparecer(posCarro.clone().addScaledVector(lado, distancia), anguloCarro);
  }

  /** Aparece a pé num lugar (começo da fase, ou ao descer do carro). `pe` = onde fica a sola do pé. */
  aparecer(pe: Vector3, angulo: number): void {
    // Um pouco acima do chão: o personagem "pousa" no primeiro passo.
    const acima = pe.clone().setY(pe.y + 0.2);
    this.fisico.ativar(true);
    this.fisico.reposicionar(acima, angulo);
    this.ativo = true;
    this.pe.copy(acima);
    this.angulo = angulo;
    this.visual.mostrar(true);
  }

  /** Entra no carro: some e sai da física. */
  subir(): void {
    this.ativo = false;
    this.fisico.ativar(false);
    this.visual.mostrar(false);
  }

  guardarEstadoAnterior(): void {
    this.fisico.guardarEstadoAnterior();
  }

  passoFisica(dt: number, comandos: ComandosAPe): void {
    this.fisico.atualizar(dt, comandos);
  }

  guardarEstado(): void {
    this.fisico.guardarEstado();
  }

  /** A cada quadro: interpola a posição e escolhe a animação. */
  desenhar(dt: number, alfa: number): void {
    const f = this.fisico;
    this.pe.lerpVectors(f.posicaoAnterior, f.posicaoAtual, alfa);
    this.pe.y -= CENTRO_ATE_PE;
    const diferenca = Math.atan2(Math.sin(f.angulo - f.anguloAnterior), Math.cos(f.angulo - f.anguloAnterior));
    this.angulo = f.anguloAnterior + diferenca * alfa;
    const rapidez = f.velocidadeHorizontal;
    let pose: PoseAPe = 'parado';
    if (!f.noChao) pose = 'pulando';
    else if (rapidez > LIMITE_CORRER) pose = 'correndo';
    else if (rapidez > QUASE_PARADO) pose = 'andando';
    this.visual.atualizar(dt, this.pe, this.angulo, pose, rapidez);
  }

  /** Tem algo sólido entre o carro e o lugar onde o personagem desceria? */
  private bloqueado(origem: Vector3, direcao: Vector3, distancia: number, corpoCarro: RAPIER.RigidBody): boolean {
    const raio = new RAPIER.Ray({ x: origem.x, y: origem.y + 0.5, z: origem.z }, { x: direcao.x, y: 0, z: direcao.z });
    const batida = this.mundo.castRay(raio, distancia + RAIO_FOLGA, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, corpoCarro);
    return batida !== null;
  }
}

