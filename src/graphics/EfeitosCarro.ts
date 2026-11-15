import { Color, Quaternion, Scene, Vector3, type PerspectiveCamera } from 'three';
import { SistemaParticulas, type ConfigParticulas } from './Particulas';
import { CAMADA_BRILHO, CAMADA_EFEITOS } from './Camadas';
import type { VeiculoFisico } from '../physics/VeiculoFisico';

// Fumaça dos pneus no drift e fogo do escapamento no nitro.

/** Fumaça de pneu: cinza-clara, cresce, sobe devagar e some. */
const FUMACA: ConfigParticulas = {
  maximo: 300,
  vida: 1.0,
  tamanhoInicial: 0.7,
  tamanhoFinal: 3.0,
  corInicial: new Color(0xd8d8d8),
  corFinal: new Color(0xa0a0a0),
  opacidade: 0.3,
  aditivo: false,
  empuxo: 0.8,
  arrasto: 1.8,
};
/** Máximo de nuvens de fumaça por segundo, por roda, com a derrapagem no máximo. */
// Cuidado ao aumentar: as nuvens se sobrepõem, e muitas nuvens fracas somadas
// viram uma parede que parece nunca sumir.
const FUMACA_POR_SEGUNDO = 20;

/** Chama do nitro: azul-branca na saída, laranja na ponta. Aditiva = brilha. */
const CHAMA: ConfigParticulas = {
  maximo: 300,
  vida: 0.14,
  tamanhoInicial: 0.35,
  tamanhoFinal: 0.12,
  // Valores bem acima de 1: "mais claro que branco". Passam do limiar do bloom e brilham.
  corInicial: new Color(6, 7, 10),
  corFinal: new Color(9, 2.5, 0.3),
  opacidade: 0.9,
  aditivo: true,
  empuxo: 0,
  arrasto: 4,
};
const CHAMA_POR_SEGUNDO = 140;
/** Velocidade da chama saindo do cano, para trás (m/s). */
const VELOCIDADE_CHAMA = 9;

const TRASEIRAS = [2, 3];

export class EfeitosCarro {
  private readonly fumaca = new SistemaParticulas(FUMACA);
  private readonly chama = new SistemaParticulas(CHAMA);
  private acumuladorFumaca = 0;
  private acumuladorChama = 0;

  constructor(cena: Scene) {
    // A chama brilha no bloom; a fumaça é só um efeito, sem brilho.
    this.chama.objeto.layers.set(CAMADA_BRILHO);
    this.fumaca.objeto.layers.set(CAMADA_EFEITOS);
    cena.add(this.fumaca.objeto, this.chama.objeto);
  }

  atualizar(dt: number, carro: VeiculoFisico, escapamentos: Vector3[], posicao: Vector3, rotacao: Quaternion): void {
    this.emitirFumaca(dt, carro);
    this.emitirChama(dt, carro, escapamentos, posicao, rotacao);
    this.fumaca.atualizar(dt);
    this.chama.atualizar(dt);
  }

  ajustarEscala(camera: PerspectiveCamera, alturaEmPixels: number): void {
    this.fumaca.ajustarEscala(camera, alturaEmPixels);
    this.chama.ajustarEscala(camera, alturaEmPixels);
  }

  private emitirFumaca(dt: number, carro: VeiculoFisico): void {
    const intensidade = carro.intensidadeDerrapagem;
    if (intensidade <= 0) return;
    this.acumuladorFumaca += intensidade * FUMACA_POR_SEGUNDO * dt;
    const velCarro = carro.velocidadeLinear();
    while (this.acumuladorFumaca >= 1) {
      this.acumuladorFumaca -= 1;
      for (const i of TRASEIRAS) {
        const contato = carro.pontoContato(i);
        if (!contato) continue;
        // A fumaça "fica para trás": nasce com só uma fração da velocidade do
        // carro, mais um espalhamento aleatório para não sair em fila indiana.
        const vel = velCarro.clone().multiplyScalar(0.15).add(aleatorio(1.5));
        this.fumaca.emitir(contato.setY(contato.y + 0.3), vel);
      }
    }
  }

  private emitirChama(dt: number, carro: VeiculoFisico, escapamentos: Vector3[], posicao: Vector3, rotacao: Quaternion): void {
    if (!carro.nitroLigado || !carro.acelerando) {
      this.acumuladorChama = 0;
      return;
    }
    this.acumuladorChama += CHAMA_POR_SEGUNDO * dt;
    const tras = new Vector3(0, 0, -1).applyQuaternion(rotacao);
    // A chama sai com a velocidade do carro + um jato para trás; sem somar a do
    // carro, a 200 km/h ela ficaria metros atrás do cano logo no primeiro quadro.
    const velBase = carro.velocidadeLinear().addScaledVector(tras, VELOCIDADE_CHAMA);
    while (this.acumuladorChama >= 1) {
      this.acumuladorChama -= 1;
      for (const local of escapamentos) {
        const mundo = local.clone().applyQuaternion(rotacao).add(posicao);
        this.chama.emitir(mundo, velBase.clone().add(aleatorio(0.8)));
      }
    }
  }
}

function aleatorio(raio: number): Vector3 {
  return new Vector3((Math.random() - 0.5) * 2 * raio, Math.random() * raio, (Math.random() - 0.5) * 2 * raio);
}
