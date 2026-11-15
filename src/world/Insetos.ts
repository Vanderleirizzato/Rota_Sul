import { AnimationMixer, Vector3, type Object3D, type Scene } from 'three';
import type { EstadoCarro } from './Cenario';
import { obterAnimacoes, obterModelo } from './CarregadorModelos';
import { carroAlcanca } from './ContatoCarro';
import type { TravessiaInsetos } from './levels/TiposFase';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// INSETOS GIGANTES ("Cuidado: bugs na pista à frente")
// =============================================================================
// Logo depois do outdoor dos bugs, alguns insetos enormes atravessam a pista,
// de um lado para o outro, sem parar. São "bugs" no sentido literal. :)
//
// Como as pessoas (Andarilhos.ts), eles NÃO têm colisor: um inseto de 5 m
// seria um muro. Quando o carro vem para cima, o inseto dá um pulo para o
// lado (um salto simples: sobe, a gravidade puxa de volta) e segue a vida.
// =============================================================================

/** Até onde (m do centro da pista) eles andam antes de voltar. */
const ALCANCE = 13;
/** Distância (m) entre um inseto e o próximo, ao longo da pista. */
const ESPACO = 9;
/** Velocidade de caminhada (m/s). */
const VELOCIDADE = 3;
/** O pulo de susto: velocidade para cima e para o lado (m/s). */
const PULO_CIMA = 9;
const PULO_LADO = 10;
const GRAVIDADE = 20;
/** Raio (m) usado para saber se o carro vai encostar. */
const RAIO = 1.6;
/** Segundos de antecedência para o susto (o pulo começa antes do carro chegar). */
const ANTECIPAR = 0.45;

interface Inseto {
  objeto: Object3D;
  mixer: AnimationMixer | null;
  distancia: number;
  lateral: number;
  /** +1 = andando para a esquerda da pista; -1 = para a direita. */
  sentido: 1 | -1;
  /** Altura acima do chão (m) e velocidade vertical, durante o pulo. */
  alturaPulo: number;
  velocidadePulo: number;
  velocidadeLado: number;
  tempo: number;
}

export class Insetos {
  private readonly insetos: Inseto[] = [];
  private impacto = 0;
  private readonly pos = new Vector3();

  constructor(
    private readonly cena: Scene,
    private readonly tracado: Tracado,
    private readonly terreno: Terreno,
    private readonly dados: TravessiaInsetos,
  ) {}

  async carregar(): Promise<void> {
    await Promise.all(
      this.dados.modelos.map(async (id, k) => {
        const objeto = await obterModelo(id);
        // Quem tem animação de andar ("Walk", como a aranha) usa; os outros
        // são estátuas e ganham um balanço feito no código.
        const andar = (await obterAnimacoes(id)).find((a) => /walk/i.test(a.name));
        let mixer: AnimationMixer | null = null;
        if (andar) {
          mixer = new AnimationMixer(objeto);
          mixer.clipAction(andar).play();
        }
        this.cena.add(objeto);
        this.insetos.push({
          objeto,
          mixer,
          distancia: this.dados.distancia + k * ESPACO,
          // Cada um começa num ponto diferente da travessia.
          lateral: ((k * 7) % (ALCANCE * 2)) - ALCANCE,
          sentido: k % 2 === 0 ? 1 : -1,
          alturaPulo: 0,
          velocidadePulo: 0,
          velocidadeLado: 0,
          tempo: k,
        });
      }),
    );
  }

  atualizar(dt: number, carro: EstadoCarro): void {
    for (const inseto of this.insetos) {
      inseto.tempo += dt;
      const i = this.tracado.indiceEm(inseto.distancia);

      // Susto: o carro vai encostar e ele está no chão → pula para longe do carro.
      this.tracado.posicaoEm(inseto.distancia, inseto.lateral, this.pos);
      if (inseto.alturaPulo === 0 && carroAlcanca(carro, this.pos, RAIO, ANTECIPAR)) {
        const e = this.tracado.esquerdas[i];
        // De que lado do carro ele está? Pula para esse lado.
        const ladoDoCarro = (this.pos.x - carro.posicao.x) * e.x + (this.pos.z - carro.posicao.z) * e.z;
        inseto.velocidadePulo = PULO_CIMA;
        inseto.velocidadeLado = (ladoDoCarro >= 0 ? 1 : -1) * PULO_LADO;
        this.impacto = Math.max(this.impacto, 0.5);
      }

      if (inseto.velocidadePulo !== 0 || inseto.alturaPulo > 0) {
        // No ar: a gravidade puxa para baixo até ele pousar.
        inseto.velocidadePulo -= GRAVIDADE * dt;
        inseto.alturaPulo = Math.max(0, inseto.alturaPulo + inseto.velocidadePulo * dt);
        inseto.lateral += inseto.velocidadeLado * dt;
        if (inseto.alturaPulo === 0) {
          inseto.velocidadePulo = 0;
          inseto.velocidadeLado = 0;
        }
      } else {
        inseto.lateral += inseto.sentido * VELOCIDADE * dt;
      }
      // Chegou na beira: dá meia-volta.
      if (inseto.lateral > ALCANCE) inseto.sentido = -1;
      if (inseto.lateral < -ALCANCE) inseto.sentido = 1;
      inseto.lateral = Math.max(-ALCANCE - 4, Math.min(ALCANCE + 4, inseto.lateral));

      this.posicionar(inseto, i);
      inseto.mixer?.update(dt);
    }
  }

  /** A batida mais forte (susto) desde a última consulta (0 a 1). */
  colherImpacto(): number {
    const valor = this.impacto;
    this.impacto = 0;
    return valor;
  }

  private posicionar(inseto: Inseto, i: number): void {
    const p = this.tracado.posicaoEm(inseto.distancia, inseto.lateral, this.pos);
    // Fora do asfalto, o chão é o terreno (pode ser mais alto ou mais baixo que a pista).
    const naPista = Math.abs(inseto.lateral) <= this.tracado.pista.largura / 2 + this.tracado.pista.acostamento;
    if (!naPista) p.y = this.terreno.alturaEm(p.x, p.z);
    // Sem animação: um passinho "saltitante" feito com seno.
    const balanco = inseto.mixer ? 0 : Math.abs(Math.sin(inseto.tempo * 9)) * 0.12;
    inseto.objeto.position.set(p.x, p.y + inseto.alturaPulo + balanco, p.z);
    // Olha para onde está andando (a esquerda da pista, ou a direita).
    const e = this.tracado.esquerdas[i];
    inseto.objeto.rotation.y = Math.atan2(e.x * inseto.sentido, e.z * inseto.sentido);
  }
}
