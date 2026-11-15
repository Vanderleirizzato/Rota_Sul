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
  /**
   * Altura fixa (m) em vez de "apoiado no chão". Para o que não fica em
   * terra firme: navios no mar, por exemplo (a altura da água menos o calado).
   */
  alturaAbsoluta?: number;
}

/**
 * Uma FILEIRA de objetos iguais (ou sorteados de uma lista) ao longo da pista:
 * coqueiros da orla, postes, prédios, pilhas de contêineres. Em vez de listar
 * 150 coqueiros um por um, dizemos "um a cada 24 m, deste trecho até aquele".
 */
export interface FileiraFase {
  /** Modelos sorteados para cada posição (um só = todos iguais). */
  modelos: IdModelo[];
  lado: Lado;
  /** Distância (m) do centro da pista até o centro dos objetos. */
  afastamento: number;
  /** Metros entre um objeto e o próximo, ao longo da pista. */
  espacamento: number;
  /** Trecho da pista (m desde o início) onde a fileira existe. */
  inicio: number;
  fim: number;
  /** Rotação extra em Y (graus). 0 = de frente para a pista; 90 = "deitado" ao longo dela. */
  rotacao?: number;
  /** Sorteio para não parecer feito com régua: até quantos metros/graus para cada lado. */
  variacaoAfastamento?: number;
  variacaoRotacao?: number;
  /** Tamanho sorteado entre os dois valores (1 = tamanho do manifesto). */
  escala?: [min: number, max: number];
  /** Chance (0 a 1) de pular uma posição, deixando um buraco na fileira. */
  falhas?: number;
  /** Empilha objetos (contêineres): quantidade sorteada entre os dois valores. */
  pilha?: [min: number, max: number];
  /** Trechos (m) em que a fileira é interrompida: entradas, passagens. */
  vaos?: [inicio: number, fim: number][];
  /**
   * Colisor de cada objeto: 'caixa' (prédios, contêineres), 'tronco' (um
   * cilindro fino: postes, coqueiros) ou 'nenhum' (decoração atravessável).
   */
  colisor: 'caixa' | 'tronco' | 'nenhum';
  /** Raio (m) do cilindro quando colisor = 'tronco'. */
  raioTronco?: number;
  /** Poste aceso: uma lâmpada que brilha no ponto `lampada` do manifesto. */
  acesa?: boolean;
}

/** Mar de um dos lados da pista, com praia descendo até a água. */
export interface DadosMar {
  lado: Lado;
  /** Altura da água (m). A pista precisa ficar acima disso. */
  nivel: number;
  /** Calçadão: faixa plana (m, a partir da beira do acostamento) antes da areia. */
  calcadao: number;
  /** Onde a areia encontra a água (m, a partir da beira do acostamento). */
  linhaDagua: number;
  corAgua: number;
  corAreia: number;
  corCalcadao: number;
}

/**
 * Pátio: área calçada e plana fora da pista (o porto, um estacionamento).
 * Ali o carro anda livre: sem freio de grama e sem voltar para a pista sozinho.
 */
export interface DadosPatio {
  inicio: number;
  fim: number;
  lado: Lado;
  /** Largura (m) a partir da beira do acostamento. */
  largura: number;
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
  /** Só andam até esta distância (m). Sem ele, até perto da chegada. Útil quando o fim da
   *  pista não tem acostamento livre (o porto, cheio de contêineres). */
  ate?: number;
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
  fileiras?: FileiraFase[];
  rio?: DadosRio;
  mar?: DadosMar;
  patios?: DadosPatio[];
  plateia: DadosPlateia[];
  andarilhos?: DadosAndarilhos;
  // O tráfego (carros, ônibus, caminhões) entra na Etapa 4.
}
