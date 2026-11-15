import type { IdModelo } from '../assets';
import type { IdBioma } from '../biomas';
import type { ConfigLuz } from '../../graphics/Iluminacao';

// =============================================================================
// O "FORMATO" DE UMA FASE
// =============================================================================
// Uma fase é só DADOS: este arquivo diz quais campos ela tem. Quem transforma
// os dados em mundo 3D é o Fase.ts (e os construtores que ele chama).
//
// Para criar uma fase nova: copie fase1-foz.ts, mude os dados e registre o
// arquivo em levels/index.ts. O TypeScript avisa se faltar algum campo.
//
// Posições AO LONGO DA PISTA são dadas em "distância": metros contados a partir
// do primeiro ponto do traçado. Assim, se você mexer na curva, os objetos
// continuam no mesmo trecho da estrada.
// =============================================================================

/** Ponto do traçado: [x, y, z] em metros. Y é a altura (subidas e descidas). */
export type PontoTracado = [x: number, y: number, z: number];

/** Lado da pista, para quem está indo da largada para a chegada. */
export type Lado = 'esquerda' | 'direita';

export interface DadosPista {
  /** Largura do asfalto (m), sem os acostamentos. */
  largura: number;
  /** Largura de cada acostamento (m). */
  acostamento: number;
  /** Inclinação lateral máxima nas curvas (graus): o lado de dentro fica mais baixo. */
  inclinacaoMaximaGraus: number;
  /** Curvas com raio menor que este (m) recebem a inclinação máxima; mais abertas, menos. */
  raioInclinacaoTotal: number;
}

/** Um objeto colocado à beira da pista (paredão, pedra, arco...). */
export interface ObjetoFase {
  modelo: IdModelo;
  /** Metros desde o início do traçado. */
  distancia: number;
  /** 'centro' = em cima da pista (arcos, pórticos). */
  lado: Lado | 'centro';
  /** Distância (m) do centro da pista até o centro do objeto. */
  afastamento: number;
  /** Rotação extra em Y (graus). 0 = "de frente" para a pista. */
  rotacao?: number;
  /** Multiplica o tamanho do manifesto. */
  escala?: number;
  /** Sobe (+) ou enterra (−) o objeto, em metros. Paredões ficam bons um pouco enterrados. */
  altura?: number;
}

/** Rio atravessando a pista por baixo de uma ponte. */
export interface DadosRio {
  /** Onde o rio cruza a pista (m desde o início). */
  distancia: number;
  /** Altura da água (m). Precisa ser bem menor que a altura da pista ali. */
  nivel: number;
  largura: number;
  /** Cachoeira rio acima: a quantos metros da ponte e de que lado. */
  cachoeira: { distancia: number; lado: Lado; altura: number };
}

/** Grupo de pessoas assistindo, atrás de uma fila de barreiras. */
export interface DadosPlateia {
  distancia: number;
  lado: Lado;
  quantidade: number;
  /** Comprimento (m) da fila ao longo da pista. */
  comprimento: number;
}

/** Mochileiros pela estrada. */
export interface DadosAndarilhos {
  /** Quantos andam pelo acostamento, cada um indo e voltando no seu trecho. */
  quantidade: number;
  /** Comprimento (m) do trecho de cada um. */
  trecho: number;
  /** Paradas de descanso: bicicleta encostada e um mochileiro parado ao lado. */
  paradas: { distancia: number; lado: Lado }[];
}

export interface DadosFase {
  /** Identificador curto (usado para salvar o recorde). */
  id: string;
  nome: string;
  /** Cidade/região, mostrada na largada. */
  local: string;
  /** Pontos por onde a estrada passa, na ordem. O jogo liga com uma curva suave. */
  tracado: PontoTracado[];
  pista: DadosPista;
  /** Distâncias (m) da linha de largada e da linha de chegada. */
  largada: number;
  chegada: number;
  bioma: IdBioma;
  iluminacao: ConfigLuz;
  objetos: ObjetoFase[];
  rio?: DadosRio;
  plateia: DadosPlateia[];
  andarilhos?: DadosAndarilhos;
  // O tráfego (carros, ônibus, caminhões) entra na Etapa 4.
}
