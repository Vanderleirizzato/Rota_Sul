import { tuning } from '../config/tuning';

// =============================================================================
// CORRIDA: contagem regressiva, cronômetro e chegada.
// =============================================================================
// Uma pequena "máquina de estados": a corrida está sempre em UM destes estados,
// e só muda de um para o outro em momentos definidos:
//
//   passeio ──(Enter no marcador, ou T)──▶ contagem ──(3, 2, 1)──▶ correndo
//      ▲  ▲                                   ▲                       │
//      │  └──(abandonar, na pausa)────────────┼───────────────────────┤
//      │                                      └───(T: de novo)────┐   │ cruzou a
//      └────────(Enter: continuar passeando)───────────────── chegou ◀┘ chegada
//
// Por que estados? Porque cada um muda o que o jogo faz: no passeio o mapa é
// livre e não há cronômetro; na contagem o carro fica preso; correndo, o
// cronômetro anda e quem sai da pista volta para ela; na chegada, aparece a
// tela de fim. Com uma variável só, fica impossível "estar correndo e
// passeando" ao mesmo tempo.
// =============================================================================

export type EstadoCorrida = 'passeio' | 'contagem' | 'correndo' | 'chegou';

/** O que aconteceu neste quadro (para tocar som e mostrar telas). */
export type EventoCorrida = { tipo: 'numero'; valor: number } | { tipo: 'largou' } | { tipo: 'chegou'; tempo: number } | null;

export class Corrida {
  /** O jogo começa passeando: a corrida só vale quando o jogador pede. */
  estado: EstadoCorrida = 'passeio';
  /** Tempo de prova (s), contado a partir do "VAI!". */
  tempo = 0;
  /** Segundos que faltam para a largada (só na contagem). */
  restante = 0;
  private ultimoNumero = 0;

  constructor(private readonly chegada: number) {}

  /** Valendo! Começa (ou recomeça) a contagem regressiva. */
  comecar(): void {
    this.estado = 'contagem';
    this.tempo = 0;
    this.restante = tuning.corrida.contagemRegressiva;
    this.ultimoNumero = Math.ceil(this.restante) + 1;
  }

  /** Volta a passear: desistiu da corrida ou já terminou. */
  voltarAoPasseio(): void {
    this.estado = 'passeio';
    this.tempo = 0;
  }

  /** Está valendo tempo (ou prestes a valer)? Aí as regras da corrida se aplicam. */
  get emProva(): boolean {
    return this.estado === 'contagem' || this.estado === 'correndo';
  }

  /** `distancia`: onde o carro está na pista (m desde o início do traçado). */
  atualizar(dt: number, distancia: number): EventoCorrida {
    if (this.estado === 'contagem') {
      this.restante -= dt;
      if (this.restante <= 0) {
        this.estado = 'correndo';
        return { tipo: 'largou' };
      }
      const numero = Math.ceil(this.restante);
      if (numero !== this.ultimoNumero) {
        this.ultimoNumero = numero;
        return { tipo: 'numero', valor: numero };
      }
      return null;
    }
    if (this.estado === 'correndo') {
      this.tempo += dt;
      if (distancia >= this.chegada) {
        this.estado = 'chegou';
        return { tipo: 'chegou', tempo: this.tempo };
      }
    }
    return null;
  }
}

/** 83.456 s → "1:23.45" */
export function formatarTempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos - minutos * 60;
  return `${minutos}:${resto.toFixed(2).padStart(5, '0')}`;
}
