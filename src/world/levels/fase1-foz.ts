import type { DadosFase } from './TiposFase';

// =============================================================================
// FASE 1: CATARATAS E FRONTEIRA (Foz do Iguaçu)
// =============================================================================
// Estrada de serra no meio da Mata Atlântica, de manhã. Começa no plano, sobe
// até o alto do morro (~38 m), desce até a ponte sobre o rio (com a cachoeira
// rio acima) e termina debaixo do grande arco de pedra.
//
// Só dados: quem monta o mundo é o Fase.ts. Para criar outra fase, copie este
// arquivo, mude os números e registre a cópia em levels/index.ts.
//
// Dica para editar o traçado: cada ponto é [x, altura, z]. Pontos muito
// próximos com mudança brusca de direção viram curvas fechadas demais; deixe
// 80 a 120 m entre eles. Subidas acima de ~8% ficam difíceis para o carro.
// =============================================================================

export const FASE1_FOZ: DadosFase = {
  id: 'fase1-foz',
  nome: 'Cataratas e Fronteira',
  local: 'Foz do Iguaçu · PR',

  // Comprimento total ≈ 3,1 km. Os comentários marcam a distância (m) de cada ponto.
  tracado: [
    [0, 0, -90], //       0 · fundo da área de largada
    [0, 0, 0], //        90 · largada
    [0, 1, 120], //     210
    [30, 4, 230], //    326
    [110, 8, 300], //   434
    [210, 13, 300], //  536 · primeira curva forte, à esquerda
    [270, 18, 230], //  630
    [290, 22, 130], //  732 · curva à direita
    [360, 25, 60], //   832
    [460, 27, 60], //   934
    [530, 30, 130], // 1036
    [540, 34, 240], // 1148
    [480, 37, 330], // 1258
    [400, 38, 380], // 1352 · alto do morro
    [330, 36, 460], // 1460
    [340, 32, 570], // 1572
    [420, 27, 640], // 1682
    [530, 22, 650], // 1794
    [620, 17, 600], // 1896
    [700, 12, 560], // 1986 · começo da reta da ponte
    [790, 10, 560], // 2078 · ponte sobre o rio
    [880, 10, 560], // 2168
    [960, 11, 600], // 2258
    [1010, 13, 690], // 2362
    [990, 15, 800], // 2476
    [920, 16, 880], // 2584 · curva mais fechada (raio ~50 m)
    [930, 15, 990], // 2696
    [1010, 13, 1060], // 2804
    [1110, 11, 1070], // 2906 · reta final
    [1200, 10, 1060], // 2996
    [1300, 10, 1060], // 3096 · fim da área de frenagem
  ],

  pista: {
    largura: 8, // duas faixas de 4 m
    acostamento: 2,
    inclinacaoMaximaGraus: 6,
    raioInclinacaoTotal: 70,
  },

  largada: 90,
  // Os 3 carros do jogador, lado a lado no fundo da área de largada (o
  // trânsito só começa aos 25 m). O jogador começa a pé, logo atrás deles.
  estacionamento: { distancia: 12, espacamento: 3.4 },
  chegada: 2930,
  bioma: 'mataAtlantica',

  // Manhã: sol baixo vindo do leste, luz dourada e sombras compridas.
  iluminacao: {
    direcaoSol: [0.55, 0.38, 0.75],
    corSol: 0xffdcb0,
    intensidadeSol: 4.2,
    corCeu: 0xd6ecff,
    corChao: 0x4d5a32, // o verde da mata reflete um pouco de luz verde por baixo
    intensidadeCeu: 1.1,
    corNeblina: 0xcfdde0,
    inicioNeblina: 0.25,
    ceu: { turbidez: 6, rayleigh: 1.8, nuvens: 0.3 },
  },

  objetos: [
    // Paredões de pedra do lado de dentro das curvas fechadas (estrada cortada no morro).
    { modelo: 'paredao', distancia: 560, lado: 'esquerda', afastamento: 18, altura: -3 },
    { modelo: 'paredao', distancia: 720, lado: 'direita', afastamento: 18, altura: -3, rotacao: 15 },
    { modelo: 'paredao', distancia: 940, lado: 'direita', afastamento: 19, altura: -4, escala: 1.2 },
    { modelo: 'paredao', distancia: 1460, lado: 'esquerda', afastamento: 18, altura: -3 },
    { modelo: 'paredao', distancia: 2480, lado: 'direita', afastamento: 18, altura: -3, rotacao: -10 },
    { modelo: 'paredao', distancia: 2585, lado: 'esquerda', afastamento: 18, altura: -2, escala: 0.9 },
    // Pedras grandes do lado de fora das curvas.
    { modelo: 'rochaMedia', distancia: 600, lado: 'direita', afastamento: 11, escala: 2.2 },
    { modelo: 'rochaMedia', distancia: 1180, lado: 'esquerda', afastamento: 11, escala: 1.8, rotacao: 40 },
    { modelo: 'rocha', distancia: 1380, lado: 'direita', afastamento: 10, escala: 2.5 },
    { modelo: 'rochaMedia', distancia: 2560, lado: 'direita', afastamento: 12, escala: 2.4 },
    // O grande arco de pedra na linha de chegada.
    { modelo: 'arco', distancia: 2930, lado: 'centro', afastamento: 0, rotacao: 90 },
    // SEGREDO: a estátua do cervo, no fim do desvio calçado (ver patios).
    { modelo: 'estatuaCervo', distancia: 1850, lado: 'esquerda', afastamento: 22, rotacao: 20 },
  ],

  // Desvio escondido: um pedacinho calçado fora da pista, onde o carro anda
  // livre (sem voltar sozinho para a estrada) até a estátua do cervo.
  patios: [{ inicio: 1832, fim: 1868, lado: 'esquerda', largura: 22 }],

  // O rio passa por baixo da reta da ponte. A cachoeira fica 60 m rio acima,
  // à esquerda: dá para vê-la de cima da ponte.
  rio: {
    distancia: 2078,
    nivel: 1,
    largura: 18,
    cachoeira: { distancia: 60, lado: 'esquerda', altura: 24 },
  },

  // Mochileiros andando pelo acostamento (saem da frente quando o carro chega)
  // e paradas de descanso com bicicleta.
  andarilhos: {
    quantidade: 8,
    trecho: 120,
    paradas: [
      { distancia: 470, lado: 'direita' },
      { distancia: 1352, lado: 'esquerda' }, // no alto do morro
      { distancia: 2230, lado: 'direita' }, // logo depois da ponte, olhando o rio
    ],
  },

  plateia: [
    { distancia: 90, lado: 'esquerda', quantidade: 8, comprimento: 22 },
    { distancia: 90, lado: 'direita', quantidade: 8, comprimento: 22 },
    // Antes do arco: os pilares dele ocupam a beira da pista bem na linha de chegada.
    { distancia: 2906, lado: 'esquerda', quantidade: 10, comprimento: 24 },
    { distancia: 2906, lado: 'direita', quantidade: 10, comprimento: 24 },
  ],

  // --- trânsito ---------------------------------------------------------------
  // Estrada de serra: muito caminhão e ônibus de turismo indo para as Cataratas.
  trafego: {
    quantidade: 8,
    mesmoSentido: 0.45,
    inicio: 25,
    fim: 3070,
    tipos: [
      { modelo: 'caminhao', peso: 3, velocidade: [55, 75] },
      { modelo: 'onibus', peso: 2, velocidade: [55, 70] },
      { modelo: 'taxi', peso: 2, velocidade: [65, 90] },
      { modelo: 'foodTruck', peso: 1, velocidade: [50, 65] },
      { modelo: 'moto', peso: 1, velocidade: [70, 95] },
      { modelo: 'esportivo', peso: 1, velocidade: [85, 110] },
      { modelo: 'viatura', peso: 1, velocidade: [75, 95] },
    ],
  },

  // --- barreiras nas curvas fechadas (raio < 75 m), do lado de FORA -----------
  // Curvas achadas medindo o traçado: 518–562 e 630–648 (para a esquerda),
  // 712–734 (direita), 1440–1472 (esquerda), 2476–2498 (direita), 2558–2594
  // (esquerda, a mais fechada: raio 47 m). Cada fileira começa um pouco antes.
  barreiras: [
    { modelo: 'barreiraConcreto', lado: 'direita', inicio: 495, fim: 670 },
    { modelo: 'barreiraTransito', lado: 'esquerda', inicio: 690, fim: 755 },
    { modelo: 'barreiraConcreto', lado: 'direita', inicio: 1420, fim: 1495 },
    { modelo: 'barreiraTransito', lado: 'esquerda', inicio: 2455, fim: 2520 },
    { modelo: 'barreiraConcreto', lado: 'direita', inicio: 2535, fim: 2615 },
  ],

  // --- cones no lado de DENTRO das curvas (quem corta caminho derruba) e uma obra
  soltos: [
    { modelo: 'cone', lado: 'esquerda', afastamento: 4.7, inicio: 520, fim: 560, espacamento: 8 },
    { modelo: 'cone', lado: 'esquerda', afastamento: 4.7, inicio: 630, fim: 650, espacamento: 7 },
    { modelo: 'cone', lado: 'direita', afastamento: 4.7, inicio: 712, fim: 734, espacamento: 7 },
    { modelo: 'cone', lado: 'esquerda', afastamento: 4.7, inicio: 1440, fim: 1472, espacamento: 8 },
    { modelo: 'cone', lado: 'direita', afastamento: 4.7, inicio: 2476, fim: 2498, espacamento: 7 },
    { modelo: 'cone', lado: 'esquerda', afastamento: 4.7, inicio: 2558, fim: 2594, espacamento: 9 },
    // Obra no acostamento: barreiras de plástico com cones avisando antes e depois.
    { modelo: 'cone', lado: 'direita', afastamento: 4.8, inicio: 985, fim: 995, espacamento: 5 },
    { modelo: 'barreiraPlastica', lado: 'direita', afastamento: 5.3, inicio: 1000, fim: 1030, espacamento: 2 },
    { modelo: 'cone', lado: 'direita', afastamento: 4.8, inicio: 1035, fim: 1045, espacamento: 5 },
  ],

  // --- easter eggs ----------------------------------------------------------
  outdoors: [
    { arte: 'dale', distancia: 330, lado: 'esquerda', afastamento: 14 },
    { arte: 'bugs', distancia: 1090, lado: 'direita', afastamento: 14 },
    { arte: 'devAds', distancia: 2300, lado: 'esquerda', afastamento: 14 },
    { arte: 'modaVerao', distancia: 2740, lado: 'direita', afastamento: 14 },
  ],
  // Logo depois do outdoor dos bugs... eles mesmos.
  insetos: { distancia: 1205, modelos: ['aranha', 'louvaDeus', 'escorpiao'] },
  // No meio da viagem, depois do alto do morro.
  portico: { distancia: 1600, titulo: 'BEM-VINDO A ENZOLÂNDIA', subtitulo: 'Velocidade Máxima: Sem Limites' },

  // --- progressão -----------------------------------------------------------
  // Terminar a corrida abaixo deste tempo (s) libera Navegantes.
  // 2:15. Calibrado com um piloto automático: sem nitro, freando cedo nas
  // curvas e batendo no trânsito, ele fez 2:25. Uma corrida limpa, com nitro, fica abaixo.
  tempoParaLiberar: 135,
  pecas: [
    // No caminho da corrida (dá para pegar correndo).
    { tipo: 'turbo', distancia: 600, lado: 'direita', afastamento: 2 },
    { tipo: 'pneus', distancia: 1450, lado: 'esquerda', afastamento: 2 },
    { tipo: 'nitro', distancia: 2500, lado: 'direita', afastamento: 2 },
    // Escondidas: atrás da estátua do cervo, no alto de um morro e na mata depois do rio.
    { tipo: 'turbo', distancia: 1850, lado: 'esquerda', afastamento: 34 },
    { tipo: 'pneus', distancia: 950, lado: 'direita', afastamento: 70 },
    { tipo: 'nitro', distancia: 2200, lado: 'esquerda', afastamento: 45 },
  ],
};
