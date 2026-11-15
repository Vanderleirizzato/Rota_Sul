// =============================================================================
// TUNING — todos os números que mudam o comportamento do carro.
// =============================================================================
// Regra do projeto: nenhum "número mágico" de jogabilidade espalhado pelo
// código. Se um valor muda a SENSAÇÃO de dirigir, ele mora aqui.
//
// Dica: aperte F2 durante o jogo para mexer nesses valores ao vivo. Quando
// achar uma combinação boa, use o botão "Copiar valores" do painel e cole
// aqui por cima, para ela virar o novo padrão.
//
// Unidades SI: metros, quilogramas, segundos, Newtons. Ângulos em radianos.
// =============================================================================

export const tuning = {
  mundo: {
    /** Aceleração da gravidade (m/s²). Mais alto: saltos curtos e carro "pesado"
     *  no chão. Mais baixo: saltos flutuantes, estilo lua. Terra = 9,81. */
    gravidade: 9.81,
  },

  chassi: {
    /** Massa do carro (kg). Mais alto: demora a acelerar e a frear, empurra
     *  melhor o tráfego. Mais baixo: ágil, mas leva trancos nas batidas. */
    massa: 1200,
    /** Altura do centro de massa acima do chão (m). É o principal remédio
     *  contra capotar: quanto mais baixo, mais difícil tombar. Um carro real
     *  fica perto de 0,5; usamos menos de propósito (truque de jogo arcade).
     *  Alto demais: capota nas curvas. Baixo demais: o carro parece "colado". */
    alturaCentroMassa: 0.3,
    /** Multiplica a inércia de rotação. Mais alto: o carro gira devagar,
     *  estável e preguiçoso. Mais baixo: gira rápido, nervoso no drift. */
    multiplicadorInercia: 1.2,
    /** Resistência do ar genérica sobre o movimento (0 = nenhuma). Mais alto:
     *  perde velocidade sozinho mais rápido. */
    amortecimentoLinear: 0.01,
    /** Freia a rotação do carro (giros e rolagem). Mais alto: menos piruetas
     *  no ar e drift mais "amortecido". Mais baixo: gira solto. */
    amortecimentoAngular: 0.8,
    /** Força para baixo que cresce com a velocidade² (pressão aerodinâmica).
     *  Mais alto: gruda no chão em alta velocidade. Zero: pode ficar leve
     *  e solto no topo de lombadas. */
    downforce: 1.2,
  },

  suspensao: {
    /** Comprimento da mola em repouso (m). Mais alto: carro mais alto e
     *  suspensão que "engole" buracos. Mais baixo: carro rebaixado. */
    comprimentoRepouso: 0.3,
    /** Quanto a mola pode comprimir no máximo (m). Mais alto: aguenta
     *  pouso de salto sem bater o fundo. */
    cursoMaximo: 0.25,
    /** Rigidez da mola (por kg de carro). Mais alto: suspensão dura, pouca
     *  inclinação, mas quica em irregularidades. Mais baixo: macia, afunda. */
    rigidez: 35,
    /** Amortecimento ao comprimir. Mais alto: segura o carro ao pousar e em
     *  frenagens. Mais baixo: afunda e balança. */
    amortecimentoCompressao: 2.6,
    /** Amortecimento ao esticar. Mais alto: a roda volta devagar, carro não
     *  quica. Mais baixo: o carro fica "pulando" depois de lombadas. */
    amortecimentoExtensao: 3.6,
    /** Força máxima de cada mola (N). Só serve de limite de segurança; baixo
     *  demais faz o carro afundar no chão em pousos. */
    forcaMaxima: 80000,
    /** Barra estabilizadora (N por metro de diferença entre os lados). Mais
     *  alto: o carro inclina menos nas curvas e capota menos. Alto demais:
     *  em terreno irregular, uma roda perde contato com facilidade. */
    barraEstabilizadora: 10000,
  },

  /**
   * Autoendireitar: um "giroscópio" de jogo arcade. No veículo por raycast, o
   * atrito lateral dos pneus age lá embaixo, no chão; quando só um lado está
   * apoiado (roda caindo do acostamento para a grama, por exemplo), esse
   * atrito vira uma alavanca e deita o carro. Carro de verdade também capota
   * assim, mas num jogo isso parece "capotou do nada".
   */
  estabilidade: {
    /** Inclinação (graus) até onde a física fica livre. Acima disso, a correção
     *  entra. Mais baixo: carro mais "grudado"; mais alto: capota mais fácil. */
    anguloLivre: 25,
    /** Força da correção (1/s²). Mais alto: desvira mais rápido e com mais
     *  vontade. 0 desliga o autoendireitar (física pura). */
    forcaEndireitar: 30,
    /** Freio do giro de capotagem (1/s). Mais alto: o carro para de girar de
     *  lado mais cedo, sem balançar. */
    amortecimento: 6,
  },

  motor: {
    /** Força de tração máxima (N), somando as rodas. Mais alto: arranca
     *  mais forte. Alto demais com tração traseira: patina e roda. */
    forca: 9000,
    /** Velocidade máxima sem nitro (km/h). */
    velocidadeMaximaKmh: 190,
    /** Quanto da força vai para as rodas traseiras (0 = só dianteira,
     *  1 = só traseira). Mais traseira: mais fácil de derrapar acelerando.
     *  Mais dianteira: estável, mas "sai de frente" nas curvas. */
    distribuicaoTraseira: 0.6,
    /** Força de marcha à ré (N). */
    forcaRe: 4000,
    /** Velocidade máxima de ré (km/h). */
    velocidadeMaximaReKmh: 35,
    /** Freio-motor (N) aplicado quando nenhum pedal está pressionado. Mais
     *  alto: solta o acelerador e o carro desacelera rápido. Zero: desliza
     *  "na banguela" para sempre. */
    freioMotor: 1500,
  },

  freios: {
    /** Força total do freio (N). Mais alto: para em menos espaço; alto demais
     *  trava as rodas e o carro escorrega. */
    forca: 12000,
    /** Força do freio de mão nas rodas traseiras (N). */
    forcaFreioMao: 3500,
  },

  direcao: {
    /** Ângulo máximo das rodas dianteiras parado (rad). 0,6 ≈ 34°. Mais alto:
     *  manobra apertado. */
    anguloMaximo: 0.6,
    /** Velocidade (m/s) em que o ângulo cai para a metade. Mais alto: curvas
     *  fechadas mesmo rápido (perigoso). Mais baixo: muito estável em alta,
     *  mas parece que o volante "endurece". 25 m/s = 90 km/h. */
    velocidadeMeiaDirecao: 25,
    /** Quão rápido o volante gira até o máximo (rad/s). Mais alto: resposta
     *  imediata, porém nervosa. Mais baixo: suave, mas atrasado. */
    velocidadeVolante: 3.0,
    /** Quão rápido o volante volta ao centro ao soltar (rad/s). */
    velocidadeRetorno: 5.0,
  },

  aderencia: {
    /** Atrito dos pneus dianteiros (parecido com o coeficiente de atrito real;
     *  1 ≈ asfalto comum). Mais alto: a frente obedece mais. */
    dianteira: 2.0,
    /** Atrito dos pneus traseiros. Menor que a dianteira: a traseira escapa
     *  primeiro (mais divertido, mais drift). Maior: carro "trilho". */
    traseira: 1.9,
    /** Rigidez lateral dos pneus. Mais alto: segura de lado com firmeza.
     *  Mais baixo: escorrega de lado mesmo sem derrapar de verdade. */
    rigidezLateral: 1.0,
  },

  grama: {
    /**
     * Freio da grama (por segundo): fração da velocidade perdida a cada
     * segundo fora do asfalto. Mais alto: sair da pista castiga mais e o carro
     * chega devagar no barranco. 0: a grama é igual ao asfalto.
     */
    arrasto: 0.36,
    /**
     * Aderência dos pneus na grama (multiplica a do asfalto). Mais baixo: o
     * carro escorrega de lado em vez de "tropeçar" e tombar. 1: igual ao asfalto.
     */
    aderencia: 0.55,
  },

  drift: {
    /** Fração da aderência traseira que sobra com o freio de mão (0 a 1).
     *  Mais baixo: a traseira solta de uma vez (drift fácil, difícil de
     *  controlar). Mais alto: precisa de velocidade para derrapar. */
    aderenciaTraseiraFreioMao: 0.35,
    /** Tempo (s) para a traseira recuperar a aderência ao soltar o freio de
     *  mão. É o que deixa o drift controlável: mais alto, o drift continua
     *  depois de soltar; mais baixo, o carro "endireita" na hora. */
    tempoRecuperacao: 0.5,
    /** Velocidade lateral (m/s) a partir da qual consideramos que o carro
     *  está derrapando (usado para recarregar o nitro e, depois, a fumaça). */
    velocidadeLateralMinima: 3.0,
    /** Ângulo máximo de derrapagem (rad) antes da assistência segurar o giro.
     *  0,7 ≈ 40°. Mais alto: drifts mais de lado, com mais risco de rodar.
     *  Acima de 1,5, a assistência praticamente desliga. */
    anguloMaximo: 0.7,
    /** Força com que a assistência freia o giro além do ângulo máximo.
     *  Zero: o carro roda como na vida real. Alto: trava no ângulo máximo. */
    correcaoGiro: 10,
    /** Quanto a direção do movimento é puxada para o nariz do carro durante o
     *  drift (rad/s). Mais alto: drift "sobre trilhos", saindo da curva sem
     *  perder embalo. Zero: física pura, o carro escorrega para fora. */
    alinhamentoVelocidade: 0.6,
  },

  nitro: {
    /** Duração do tanque cheio de nitro (s). */
    duracao: 4,
    /** Multiplica a força do motor com nitro ligado. */
    multiplicadorForca: 1.8,
    /** Velocidade máxima extra com nitro (km/h). */
    velocidadeExtraKmh: 50,
    /** Recarga por segundo, sem fazer nada (fração do tanque: 0,05 = 5%/s). */
    recargaPassiva: 0.03,
    /** Recarga extra por segundo enquanto derrapa. Mais alto: premia o drift. */
    recargaDrift: 0.2,
  },

  transmissao: {
    // A transmissão é "de mentira": não muda a força do carro (essa vem da
    // curva do motor), só decide a marcha e o giro mostrados no conta-giros e
    // ouvidos no som do motor.
    /** Velocidade (km/h) em que cada marcha chega ao giro máximo. Mais marchas
     *  ou marchas mais curtas: mais trocas, som mais "nervoso". */
    velocidadeMaximaMarchas: [45, 80, 115, 150, 190, 250],
    /** Giro do motor parado (rpm). */
    rpmMarchaLenta: 900,
    /** Giro máximo (rpm). Acima de 85% disso o conta-giros fica vermelho. */
    rpmMaximo: 7200,
    /** Sobe a marcha ao passar deste giro. */
    rpmTrocaSubida: 6600,
    /** Desce a marcha ao cair abaixo deste giro. */
    rpmTrocaDescida: 3200,
  },

  reposicionamento: {
    /** Segundos tombado (de lado ou de cabeça para baixo) antes de voltar sozinho para a pista. */
    tempoCapotado: 2,
    /**
     * A partir de quantos graus de inclinação o carro conta como "tombado".
     * Mais baixo: volta para a pista mais cedo, até em barrancos fortes.
     */
    inclinacaoTombado: 45,
    /** Abaixo desta altura (m) consideramos que o carro caiu do mundo. */
    alturaQueda: -20,
    /**
     * Nas fases: a quantos metros além da beira do acostamento o carro é
     * considerado "fora da pista". Mais alto: dá para passear mais pelo mato.
     */
    distanciaForaPista: 14,
    /** Segundos fora da pista antes de voltar sozinho para o asfalto. */
    tempoForaPista: 2,
    /** Metros abaixo do asfalto (caiu da ponte, rolou barranco abaixo) para voltar na hora. */
    quedaAbaixoPista: 6,
    /** Fases com mar: o carro volta para a pista quando o centro dele fica abaixo
     *  deste tanto (m) acima da água. Mais alto: volta antes de molhar as rodas. */
    alturaNoMar: 0.3,
  },

  corrida: {
    /** Segundos de contagem regressiva antes da largada (3, 2, 1...). */
    contagemRegressiva: 3,
  },

  camera: {
    /** Distância atrás do carro (m) quando parado. */
    distancia: 6.5,
    /** Altura acima do carro (m). */
    altura: 2.4,
    /** Distância extra em velocidade máxima: a câmera "fica para trás",
     *  passando sensação de velocidade. */
    distanciaExtraVelocidade: 2.5,
    /** Campo de visão parado (graus). */
    fovBase: 65,
    /** Graus a mais de campo de visão na velocidade máxima. */
    fovExtraVelocidade: 12,
    /** Graus a mais de campo de visão com nitro ligado. */
    fovExtraNitro: 10,
    /** Rapidez com que a câmera alcança a posição ideal. Mais alto: grudada
     *  e firme. Mais baixo: atrasada e "elástica" (inércia). */
    suavidadePosicao: 5,
    /** Rapidez com que a câmera acompanha a direção do carro. Mais baixo:
     *  em drift dá para ver a lateral do carro. */
    suavidadeDirecao: 4,
    /** Ponto para onde a câmera olha, à frente do carro (m). */
    olharAFrente: 4,
    /** Multiplicador de distância e altura na câmera "longe". */
    multiplicadorLonge: 1.7,
  },
};

/** Tipo do objeto de tuning (útil para quem recebe o tuning por parâmetro). */
export type Tuning = typeof tuning;
