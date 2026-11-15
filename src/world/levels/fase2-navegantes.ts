import type { DadosFase, FileiraFase, Lado, ObjetoFase } from './TiposFase';

// =============================================================================
// FASE 2: ORLA E PORTO (Navegantes)
// =============================================================================
// Avenida beira-mar rápida, com curvas longas e abertas, no fim da tarde. O mar
// fica à direita (com o sol se pondo sobre ele), a cidade à esquerda. A
// corrida termina no porto, num corredor de contêineres empilhados.
//
// Mesmo formato da Fase 1 (só dados). O que é novo aqui:
//   - mar: a praia e o plano de água (Mar.ts);
//   - fileiras: coqueiros, postes acesos, prédios e contêineres repetidos;
//   - patios: o chão calçado do porto, onde o carro anda livre.
// =============================================================================

/** Contêiner de 20 pés no jogo: 6,06 m de comprido e 2,46 m de altura. */
const ALTURA_CONTEINER = 2.46;

/**
 * Parede de contêineres "atravessada" (perpendicular à pista), de dois andares,
 * fechando uma ponta do esconderijo do porto. Uma fileira não serve aqui: ela
 * anda AO LONGO da pista, e esta parede anda para longe dela.
 */
function paredeAtravessada(distancia: number): ObjetoFase[] {
  const afastamentos = [13.4, 19.5, 25.6, 31.7];
  return afastamentos.flatMap((afastamento) => [
    { modelo: 'conteiner', distancia, lado: 'esquerda', afastamento },
    { modelo: 'conteiner', distancia, lado: 'esquerda', afastamento, altura: ALTURA_CONTEINER },
  ]);
}

/** Trecho (m) da avenida ocupado pelo bairro: as fileiras da avenida param aqui. */
const VAO_BAIRRO: [number, number] = [1010, 1370];

/**
 * Grupo de capivaras pastando: uma "fileira" bem curta e apertada, com cada
 * bicho virado para um lado e um pouco fora da linha. Algumas são filhotes.
 */
function grupoDeCapivaras(distancia: number, lado: Lado, afastamento: number, quantidade = 4): FileiraFase {
  return {
    modelos: ['capivara'],
    lado,
    afastamento,
    espacamento: 1.8,
    inicio: distancia,
    fim: distancia + 1.8 * (quantidade - 1),
    variacaoAfastamento: 1.6,
    variacaoRotacao: 180,
    escala: [0.6, 1.1],
    colisor: 'caixa',
  };
}

export const FASE2_NAVEGANTES: DadosFase = {
  id: 'fase2-navegantes',
  nome: 'Orla e Porto',
  local: 'Navegantes · SC',

  // Comprimento total ≈ 4,8 km: uns 2 minutos e meio de corrida.
  tracado: [
    [0, 3, -90], //        0 · fundo da área de largada
    [0, 3, 0], //         90 · largada
    [4, 3, 220], //      310
    [-14, 3.5, 460], //  551
    [-56, 4, 700], //    795 · primeira curva longa
    [-88, 4.5, 950], // 1047
    [-92, 4.5, 1200], //1297
    [-60, 4, 1450], //  1549
    [-8, 3.5, 1700], // 1804 · curva para o outro lado
    [36, 3, 1950], //   2058
    [48, 3, 2200], //   2308
    [24, 3.5, 2450], // 2559
    [-24, 4, 2700], //  2814
    [-66, 4.5, 2950], //3067
    [-74, 4, 3200], //  3317
    [-48, 3.5, 3450], //3568
    [-16, 3, 3650], //  3771 · entrada do porto: daqui em diante, reta e plana
    [-6, 3, 3800], //   3921
    [-4, 3, 4000], //   4121
    [-4, 3, 4200], //   4321
    [-4, 3, 4400], //   4521
    [-4, 3, 4600], //   4721
    [-4, 3, 4720], //   4841 · fim da área de frenagem
  ],

  pista: {
    largura: 8,
    acostamento: 2,
    // Curvas abertas e rápidas: inclinação suave.
    inclinacaoMaximaGraus: 4,
    raioInclinacaoTotal: 120,
  },

  largada: 90,
  // Os 3 carros do jogador, lado a lado no fundo da área de largada (o
  // trânsito só começa aos 25 m). O jogador começa a pé, logo atrás deles.
  estacionamento: { distancia: 12, espacamento: 3.4 },
  chegada: 4480,
  bioma: 'litoral',

  // Pôr do sol: sol bem baixo, à frente e à direita, sobre o mar. Luz laranja,
  // céu rosado e neblina quente. O rastro do sol na água vem daqui.
  iluminacao: {
    direcaoSol: [-0.7, 0.1, 0.7],
    corSol: 0xffa25c,
    intensidadeSol: 3.4,
    corCeu: 0xffcfae,
    corChao: 0x6b5a48,
    intensidadeCeu: 0.9,
    corNeblina: 0xf2bc94,
    inicioNeblina: 0.3,
    ceu: { turbidez: 9, rayleigh: 2.6, nuvens: 0.35 },
  },

  mar: {
    lado: 'direita',
    nivel: 0,
    calcadao: 8, // passeio da orla: postes e coqueiros ficam nele
    linhaDagua: 50,
    corAgua: 0x1c5a72,
    corAreia: 0xe2cf9e,
    corCalcadao: 0xbdb5a5,
  },

  // O porto todo é calçado: dá para andar entre os contêineres sem voltar sozinho para a pista.
  patios: [
    { inicio: 3800, fim: 4900, lado: 'esquerda', largura: 60 },
    { inicio: 3800, fim: 4900, lado: 'direita', largura: 34 },
  ],

  // Bairro do lado da cidade, com ruas para explorar. As fileiras de prédios
  // e postes da avenida têm um vão neste trecho (VAO_BAIRRO) para não ficarem
  // em cima das ruas.
  bairros: [
    {
      lado: 'esquerda',
      inicio: VAO_BAIRRO[0],
      fim: VAO_BAIRRO[1],
      fileirasDeQuadras: 2,
      quadra: 40,
      rua: 10,
      construcoes: [
        ['casa', 'casa2', 'predioPequeno', 'bar'], // de frente para a avenida
        ['predioApartamentos', 'predioVermelho', 'predioGrande', 'predioPequeno'],
      ],
      pracas: 0.15,
      carrosEstacionados: 0.35,
      modelosCarros: ['taxi', 'esportivo', 'viatura', 'foodTruck'],
      postesAcesos: true, // pôr do sol
    },
  ],

  fileiras: [
    // --- orla (lado do mar) ---------------------------------------------------
    { modelos: ['posteLampiao'], lado: 'direita', afastamento: 9.5, espacamento: 30, inicio: 140, fim: 3760, colisor: 'tronco', raioTronco: 0.12, acesa: true, derrubavel: true },
    {
      modelos: ['coqueiro'], lado: 'direita', afastamento: 12.5, espacamento: 30, inicio: 155, fim: 3760,
      variacaoAfastamento: 1.2, variacaoRotacao: 180, escala: [0.85, 1.15], colisor: 'tronco', raioTronco: 0.3,
    },
    // Palmeiras-anãs soltas na areia.
    { modelos: ['palmeiraBaixa'], lado: 'direita', afastamento: 24, espacamento: 45, inicio: 170, fim: 3700, variacaoAfastamento: 5, variacaoRotacao: 180, falhas: 0.3, colisor: 'nenhum' },

    // --- avenida (lado da cidade) ----------------------------------------------
    // O braço do poste aponta para a pista: a lâmpada fica sobre o acostamento.
    { modelos: ['posteRua'], lado: 'esquerda', afastamento: 7.8, espacamento: 40, inicio: 130, fim: 3780, colisor: 'tronco', raioTronco: 0.15, acesa: true, derrubavel: true, vaos: [VAO_BAIRRO] },
    // Primeira quadra: casas e prédios baixos. O vão é onde fica o bar.
    {
      modelos: ['casa', 'casa2', 'predioPequeno', 'predioVermelho'], lado: 'esquerda', afastamento: 24, espacamento: 20,
      inicio: 150, fim: 3700, variacaoAfastamento: 3, falhas: 0.12, vaos: [[600, 640], VAO_BAIRRO], colisor: 'caixa',
    },
    // Segunda quadra, atrás: os prédios altos.
    {
      modelos: ['predioApartamentos', 'predioGrande', 'predioVermelho'], lado: 'esquerda', afastamento: 52, espacamento: 34,
      inicio: 160, fim: 3720, variacaoAfastamento: 6, falhas: 0.1, vaos: [VAO_BAIRRO], colisor: 'caixa',
    },

    // --- capivaras ----------------------------------------------------------
    // Na grama do lado da cidade e na areia da praia, longe dos postes.
    grupoDeCapivaras(424, 'esquerda', 11),
    grupoDeCapivaras(1470, 'esquerda', 12, 5),
    grupoDeCapivaras(2052, 'esquerda', 11, 3),
    grupoDeCapivaras(3305, 'esquerda', 12),
    grupoDeCapivaras(800, 'direita', 20, 3),
    grupoDeCapivaras(1905, 'direita', 21, 5),
    grupoDeCapivaras(2660, 'direita', 20),

    // --- porto: contêineres ---------------------------------------------------
    // Corredor da pista, lado da cidade. Ele é dividido em DUAS fileiras com
    // uma fresta de ~4 m entre elas (de 4035 a 4039 m): a passagem estreita e
    // discreta para o esconderijo atrás dos contêineres.
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'esquerda', afastamento: 8.6, espacamento: 6.3,
      inicio: 3830, fim: 4037, rotacao: 90, pilha: [2, 3], colisor: 'caixa',
    },
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'esquerda', afastamento: 8.6, espacamento: 6.3,
      inicio: 4042, fim: 4300, rotacao: 90, pilha: [2, 3], colisor: 'caixa',
    },
    // Pilhas mais para dentro do pátio, formando corredores. Param no esconderijo.
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'esquerda', afastamento: 16, espacamento: 6.3,
      inicio: 3830, fim: 4300, rotacao: 90, pilha: [1, 3], falhas: 0.15, vaos: [[3984, 4106]], colisor: 'caixa',
    },
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'esquerda', afastamento: 24, espacamento: 6.3,
      inicio: 3830, fim: 4300, rotacao: 90, pilha: [1, 4], falhas: 0.2, vaos: [[3984, 4106]], colisor: 'caixa',
    },
    // Fundo do esconderijo.
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'esquerda', afastamento: 36, espacamento: 6.3,
      inicio: 3990, fim: 4100, rotacao: 90, pilha: [2, 3], colisor: 'caixa',
    },
    // Lado do mar: o cais.
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'direita', afastamento: 8.6, espacamento: 6.3,
      inicio: 3830, fim: 4300, rotacao: 90, pilha: [1, 3], colisor: 'caixa',
    },
    {
      modelos: ['conteiner', 'conteinerVerde'], lado: 'direita', afastamento: 16, espacamento: 6.3,
      inicio: 3830, fim: 4300, rotacao: 90, pilha: [2, 4], falhas: 0.1, colisor: 'caixa',
    },
  ],

  objetos: [
    // O bar da orla, de frente para a avenida.
    { modelo: 'bar', distancia: 620, lado: 'esquerda', afastamento: 16 },

    // ESCONDERIJO DO PORTO (usado na Etapa 5): o espaço vazio entre 3990 e
    // 4100 m, de 10 a 35 m da pista, do lado da cidade. Fechado na frente pela
    // fileira do corredor (com a fresta em ~4037 m), no fundo pela fileira a
    // 36 m e nas pontas por estas duas paredes atravessadas.
    ...paredeAtravessada(3986),
    ...paredeAtravessada(4104),

    // Navios no horizonte, sobre o mar (sem colisor: ninguém chega lá).
    { modelo: 'transatlantico', distancia: 1700, lado: 'direita', afastamento: 260, rotacao: 80, alturaAbsoluta: -6 },
    { modelo: 'navioConteineres', distancia: 3350, lado: 'direita', afastamento: 230, rotacao: 95, alturaAbsoluta: -5 },
    { modelo: 'navioConteineres', distancia: 600, lado: 'direita', afastamento: 300, rotacao: 100, alturaAbsoluta: -5, escala: 0.9 },
  ],

  andarilhos: {
    quantidade: 6,
    trecho: 150,
    // Só na orla: no porto, os contêineres ocupam a beira da pista.
    ate: 3600,
    paradas: [
      { distancia: 1500, lado: 'direita' },
      { distancia: 2900, lado: 'direita' },
    ],
  },

  plateia: [
    { distancia: 90, lado: 'esquerda', quantidade: 8, comprimento: 22 },
    { distancia: 90, lado: 'direita', quantidade: 8, comprimento: 22 },
    // Chegada no pátio do porto, depois do corredor de contêineres.
    { distancia: 4460, lado: 'esquerda', quantidade: 10, comprimento: 26 },
    { distancia: 4460, lado: 'direita', quantidade: 10, comprimento: 26 },
  ],

  // --- trânsito ---------------------------------------------------------------
  // Avenida de cidade de praia: táxi, ônibus, lambretas; caminhões do porto.
  trafego: {
    quantidade: 12,
    mesmoSentido: 0.5,
    inicio: 25,
    fim: 4800,
    tipos: [
      { modelo: 'taxi', peso: 3, velocidade: [55, 80] },
      { modelo: 'onibus', peso: 2, velocidade: [45, 65] },
      { modelo: 'vespa', peso: 2, velocidade: [35, 50] },
      { modelo: 'moto', peso: 2, velocidade: [60, 85] },
      { modelo: 'caminhao', peso: 2, velocidade: [50, 70] },
      { modelo: 'foodTruck', peso: 1, velocidade: [40, 55] },
      { modelo: 'esportivo', peso: 1, velocidade: [70, 100] },
      { modelo: 'viatura', peso: 1, velocidade: [60, 80] },
    ],
  },

  // --- barreiras --------------------------------------------------------------
  // A orla não tem curva fechada (todas com raio acima de 700 m). As barreiras
  // marcam o "funil" da entrada do porto. O lado esquerdo depois de 3800 fica
  // livre de propósito: é por lá que se chega à fresta dos contêineres.
  barreiras: [
    { modelo: 'barreiraTransito', lado: 'direita', inicio: 3730, fim: 3795 },
    { modelo: 'barreiraConcreto', lado: 'esquerda', inicio: 3745, fim: 3795 },
  ],

  // --- cones e obras --------------------------------------------------------
  soltos: [
    // Obra no calçadão: barreiras de plástico, com cones antes e depois.
    { modelo: 'cone', lado: 'direita', afastamento: 4.8, inicio: 1588, fim: 1596, espacamento: 4 },
    { modelo: 'barreiraPlastica', lado: 'direita', afastamento: 5.3, inicio: 1600, fim: 1630, espacamento: 2 },
    { modelo: 'cone', lado: 'direita', afastamento: 4.8, inicio: 1634, fim: 1642, espacamento: 4 },
    // Cones na entrada do porto, nas duas beiras da pista.
    { modelo: 'cone', lado: 'esquerda', afastamento: 4.7, inicio: 3760, fim: 3800, espacamento: 8 },
    { modelo: 'cone', lado: 'direita', afastamento: 4.7, inicio: 3760, fim: 3800, espacamento: 8 },
  ],

  // --- easter eggs ----------------------------------------------------------
  // Navegantes é a casa da Dale: três outdoors dela pela avenida.
  outdoors: [
    { arte: 'daleNavegantes', distancia: 260, lado: 'esquerda', afastamento: 14 },
    { arte: 'dale', distancia: 980, lado: 'esquerda', afastamento: 14 },
    // Na areia, de frente para a avenida (entre um poste e um coqueiro).
    { arte: 'modaVerao', distancia: 1708, lado: 'direita', afastamento: 19 },
    { arte: 'bugs', distancia: 2240, lado: 'esquerda', afastamento: 14 },
    { arte: 'devAds', distancia: 2950, lado: 'esquerda', afastamento: 14 },
    { arte: 'daleNavegantes', distancia: 3550, lado: 'esquerda', afastamento: 14 },
  ],
  insetos: { distancia: 2320, modelos: ['escorpiao', 'aranha', 'louvaDeus'] },
  // No esconderijo atrás dos contêineres do porto (entrada pela fresta em ~4037 m).
  trofeu: { distancia: 4045, lado: 'esquerda', afastamento: 22 },

  // --- progressão -----------------------------------------------------------
  // Navegantes é a última fase por enquanto: este tempo vai liberar a próxima
  // que alguém criar depois dela na lista (levels/index.ts).
  // 2:15. Calibrado com um piloto automático: sem nitro, freando cedo nas
  // curvas e batendo no trânsito, ele fez 2:22. Uma corrida limpa, com nitro, fica abaixo.
  tempoParaLiberar: 135,
  pecas: [
    // No caminho da corrida.
    { tipo: 'turbo', distancia: 800, lado: 'direita', afastamento: 2 },
    { tipo: 'pneus', distancia: 2000, lado: 'esquerda', afastamento: 2 },
    { tipo: 'nitro', distancia: 3300, lado: 'direita', afastamento: 2 },
    // Escondidas: na areia da praia, atrás das casas e no esconderijo do porto.
    { tipo: 'turbo', distancia: 1500, lado: 'direita', afastamento: 30 },
    { tipo: 'pneus', distancia: 2600, lado: 'esquerda', afastamento: 60 },
    { tipo: 'nitro', distancia: 4070, lado: 'esquerda', afastamento: 30 },
  ],
};
