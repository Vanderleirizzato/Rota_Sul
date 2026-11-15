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
  /** O carro derruba (postes): batendo rápido, ele tomba em vez de parar o carro. Precisa de colisor 'tronco'. */
  derrubavel?: boolean;
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
  trafego?: DadosTrafego;
  /** Barreiras fixas na beira das curvas perigosas. */
  barreiras?: BarreiraFase[];
  /** Cones e barreiras de plástico que voam quando o carro bate. */
  soltos?: GrupoSoltos[];

  // --- easter eggs ---------------------------------------------------------
  /** Outdoors na beira da estrada, cada um com uma arte (ver graphics/ArteOutdoor.ts). */
  outdoors?: OutdoorFase[];
  /** Pórtico de entrada de cidade, atravessando a pista. */
  portico?: PorticoFase;
  /** Insetos gigantes que atravessam a pista, indo e voltando. */
  insetos?: TravessiaInsetos;
  /** O troféu que libera o Modo Dev (escondido em algum lugar da fase). */
  trofeu?: TrofeuFase;

  // --- progressão (Etapa 8) --------------------------------------------------
  /**
   * Tempo-meta (s): terminar a corrida abaixo dele libera a PRÓXIMA fase da
   * lista (levels/index.ts). Sem este campo, a fase não libera nada.
   * Mais alto: mais fácil seguir viagem. Calibre dirigindo: uma volta "boa,
   * mas não perfeita" deve ficar um pouco abaixo.
   */
  tempoParaLiberar?: number;
  /** Peças de tuning espalhadas pelo mapa: cada uma dá um bônus pequeno e permanente ao carro. */
  pecas?: PecaFase[];
}

/** Os tipos de peça; o bônus de cada um fica em tuning.pecas. */
export type TipoPeca = 'turbo' | 'pneus' | 'nitro';

/**
 * Uma peça de tuning, flutuando no mapa. Algumas no caminho da corrida
 * (afastamento pequeno), outras escondidas (longe da pista).
 */
export interface PecaFase {
  tipo: TipoPeca;
  distancia: number;
  lado: Lado;
  afastamento: number;
}

/** As artes que existem para os outdoors. */
export type ArteOutdoor = 'bugs' | 'devAds' | 'dale' | 'daleNavegantes' | 'modaVerao';

/** Um outdoor de frente para a pista. */
export interface OutdoorFase {
  arte: ArteOutdoor;
  distancia: number;
  lado: Lado;
  /** Distância (m) do centro da pista até o outdoor. Ele tem ~7,5 m de largura. */
  afastamento: number;
  /** Giro extra (graus). Ele já vem virado para quem chega pela estrada (ver Outdoors.ts). */
  rotacao?: number;
}

/** Pórtico de "bem-vindo a ...", com placa pintada no código. */
export interface PorticoFase {
  distancia: number;
  titulo: string;
  subtitulo: string;
}

/** Insetos gigantes atravessando a pista em `distancia`, um atrás do outro. */
export interface TravessiaInsetos {
  distancia: number;
  modelos: IdModelo[];
}

/** Onde fica o troféu. */
export interface TrofeuFase {
  distancia: number;
  lado: Lado;
  afastamento: number;
}

/** Um tipo de veículo do trânsito. */
export interface TipoVeiculo {
  modelo: IdModelo;
  /** Chance relativa de aparecer (um tipo com peso 2 aparece o dobro de um com peso 1). */
  peso: number;
  /** Velocidade (km/h) sorteada entre os dois valores. */
  velocidade: [min: number, max: number];
}

/**
 * Trânsito: veículos nas duas mãos da pista. Só existem perto do jogador:
 * nascem longe (fora da vista) e somem quando ficam para trás.
 */
export interface DadosTrafego {
  /** Quantos veículos ao mesmo tempo em volta do jogador. Mais: estrada mais cheia (e mais pesada). */
  quantidade: number;
  /** Fração (0 a 1) que vai no mesmo sentido do jogador; o resto vem na contramão. */
  mesmoSentido: number;
  /** Trecho da pista (m) onde há trânsito. */
  inicio: number;
  fim: number;
  tipos: TipoVeiculo[];
}

/**
 * Fileira de barreiras FIXAS na beira do acostamento, de `inicio` a `fim`.
 * O colisor é um muro contínuo: o carro raspa e desliza, sem enroscar nas emendas.
 */
export interface BarreiraFase {
  modelo: IdModelo;
  lado: Lado;
  inicio: number;
  fim: number;
}

/** Cones ou barreiras de plástico SOLTOS (a física move), um a cada `espacamento` metros. */
export interface GrupoSoltos {
  modelo: 'cone' | 'barreiraPlastica';
  lado: Lado;
  /** Distância (m) do centro da pista. 4,6 = na faixa branca da beira (largura 8). */
  afastamento: number;
  inicio: number;
  fim: number;
  espacamento: number;
  /** Rotação extra em Y (graus). 0 = de frente para a pista (a barreira fica ao longo dela);
   *  90 = atravessada, fechando a faixa. */
  rotacao?: number;
}
