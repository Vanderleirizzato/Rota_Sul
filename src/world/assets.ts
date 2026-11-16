// =============================================================================
// MANIFESTO DE MODELOS 3D
// =============================================================================
// Cada modelo baixado da internet vem numa escala diferente: o ônibus tinha
// 157 m de comprimento, o paredão 1,4 km de altura, o arco 26 cm. Em vez de
// corrigir isso espalhado pelo código, cada modelo tem aqui UMA linha dizendo
// o tamanho que ele deve ter no jogo. O carregador (CarregadorModelos.ts) lê
// esta tabela, escala o modelo, centraliza em X/Z e apoia a base em Y = 0.
//
// Para medir os arquivos originais: npm run inspecionar-modelos
//
// Convenção do jogo: veículos e personagens olham para +Z.
//
// Formatos aceitos: .glb (o padrão) e .fbx (só a ponte veio assim).
// =============================================================================

/** Qual dimensão do modelo deve ficar com o tamanho `metros`. */
export type Medida =
  | 'altura' //      eixo Y
  | 'comprimento'; // maior dimensão horizontal (X ou Z)

/** Nomes dos nós de roda dentro do .glb, na ordem usada pela física. */
export interface RodasDoModelo {
  dianteiraEsquerda: string;
  dianteiraDireita: string;
  traseiraEsquerda: string;
  traseiraDireita: string;
}

export interface InfoModelo {
  /** Caminho dentro de public/. */
  arquivo: string;
  medida: Medida;
  /** Tamanho-alvo em metros, na dimensão `medida`. */
  metros: number;
  /** Rotação de correção em Y (graus), aplicada antes de medir. */
  rotacaoY: number;
  /** Objeto sólido (recebe colisor) ou decorativo (atravessável). */
  solido: boolean;
  /** Só para carros: onde estão as rodas no modelo. */
  rodas?: RodasDoModelo;
  /** Só para carros: nome do modelo (para quem ler o manifesto). */
  nome?: string;
  /** Só para carros: altura (m) do centro da placa traseira "ENZ-ADS". */
  alturaPlaca?: number;
  /** Algo a conferir quando o modelo entrar no jogo. */
  observacao?: string;
  /** Pessoa que pode aparecer na plateia (largada e chegada). */
  plateia?: boolean;
  /** Pessoa que anda pelo acostamento (precisa ter animação "Walk"). */
  andarilho?: boolean;
  /**
   * Arcos e pórticos: fração do comprimento, no meio, que fica livre para
   * passar por baixo. O colisor vira dois pilares, um em cada ponta.
   */
  vaoLivre?: number;
  /**
   * Tira o brilho de metal do material (o modelo veio "envernizado" da
   * conversão de formato). Usado nas pessoas: pele e roupa não refletem o céu.
   */
  fosco?: boolean;
  /** Cor que substitui o material original (para modelos cuja textura não veio junto). */
  corMaterial?: number;
  /**
   * Postes: onde fica a lâmpada (m), no modelo já no tamanho do jogo e olhando
   * para +Z (a pista). Medido com o script de medição; ver fileiras "acesas".
   */
  lampada?: [x: number, y: number, z: number];
  /**
   * Motos e lambretas do trânsito: quem vai montado. `modelo` é o id de uma
   * pessoa deste manifesto, `animacao` a pose de sentado (o boneco fica
   * congelado nela) e `posicao` onde ele senta (m), com o veículo olhando para +Z.
   * Achado na tentativa e erro, olhando o veículo de lado.
   */
  piloto?: { modelo: string; animacao: string; posicao: [x: number, y: number, z: number] };
  /** Outdoors: nome do material da placa (onde a arte é colada na frente). */
  materialPainel?: string;
}

const M = 'models/';
const PI = `${M}pessoas e Insetos/`;
const C = `${M}city/`;

export const MODELOS = {
  // ---------------------------------------------------------------- carros --
  // Os carros do jogador (teclas 1, 2 e 3). Atenção: o id não é o nome do
  // arquivo. O carro1 é o esportivo novo; o carro2 usa o Carro1.glb e o
  // carro3 usa o Carro2.glb (a ordem mudou quando o esportivo chegou).
  carro1: {
    nome: 'Esportivo',
    alturaPlaca: 0.55,
    arquivo: `${M}cars/CAR Model by Ignition Labs - 5zUWP5UsLg-.glb`,
    medida: 'comprimento',
    metros: 4.8,
    rotacaoY: 0,
    solido: true,
    // Rodas já vêm separadas e com nome; a frente do modelo aponta para +Z.
    rodas: {
      dianteiraEsquerda: 'Lamborghini_Aventador_Wheel_FL',
      dianteiraDireita: 'Lamborghini_Aventador_Wheel_FR',
      traseiraEsquerda: 'Lamborghini_Aventador_Wheel_RL',
      traseiraDireita: 'Lamborghini_Aventador_Wheel_RR',
    },
  },
  carro2: {
    nome: 'Jipe Aventureiro',
    // Logo abaixo do estepe (mais alto, o estepe cobriria a placa).
    alturaPlaca: 0.52,
    arquivo: `${M}cars/Carro1.glb`,
    medida: 'comprimento',
    metros: 4.6,
    rotacaoY: 0,
    solido: true,
    // O comprimento inclui o estepe na traseira, por isso 4,6 e não 4,5.
    rodas: {
      dianteiraEsquerda: 'Tire1',
      dianteiraDireita: 'Tire3',
      traseiraEsquerda: 'Tire2',
      traseiraDireita: 'Tire4',
    },
    observacao: 'Lataria, pneus e estepe usam o mesmo material "Texture": cuidado ao aplicar clearcoat (Etapa 1B).',
  },
  carro3: {
    nome: 'Picape',
    alturaPlaca: 0.62,
    arquivo: `${M}cars/Carro2.glb`,
    medida: 'comprimento',
    metros: 4.5,
    rotacaoY: 0,
    solido: true,
    // As duas rodas traseiras são UMA malha só ("BackWheels"): giram juntas.
    rodas: {
      dianteiraEsquerda: 'FrontWheel_L',
      dianteiraDireita: 'FrontWheel_R',
      traseiraEsquerda: 'BackWheels',
      traseiraDireita: 'BackWheels',
    },
  },

  // --------------------------------------------------------------- tráfego --
  // Os que têm `rodas` também podem ser dirigidos: a pé, chegue perto e aperte E.
  // (Ônibus e food truck vêm numa malha só, sem rodas separadas: só enfeitam.)
  // Atenção: o carregador tira os pontos dos nomes ("Cube.013" vira "Cube013").
  onibus: { arquivo: `${M}cars/Bus by Poly by Google - 4CPpvEmrMoF.glb`, medida: 'comprimento', metros: 12, rotacaoY: 0, solido: true },
  taxi: { arquivo: `${M}cars/Taxi by Quaternius - x43lOScTpN.glb`, medida: 'comprimento', metros: 4.5, rotacaoY: 0, solido: true,
    rodas: { dianteiraEsquerda: 'Taxi_FrontLeftWheel_Cube013', dianteiraDireita: 'Taxi_FrontRightWheel_Cube014', traseiraEsquerda: 'Taxi_BackWheels_Cube010', traseiraDireita: 'Taxi_BackWheels_Cube010' } },
  caminhao: { arquivo: `${M}cars/Truck by Quaternius - cXw6oiFtZ8.glb`, medida: 'comprimento', metros: 7, rotacaoY: 0, solido: true,
    rodas: { dianteiraEsquerda: 'FrontWheel_L', dianteiraDireita: 'FrontWheel_R', traseiraEsquerda: 'BackWheels', traseiraDireita: 'BackWheels' } },
  viatura: { arquivo: `${M}cars/Police Car by Kay Lousberg - Uj7i2vlmir.glb`, medida: 'comprimento', metros: 4.7, rotacaoY: 0, solido: true,
    rodas: { dianteiraEsquerda: 'car_police_wheel_front_left', dianteiraDireita: 'car_police_wheel_front_right', traseiraEsquerda: 'car_police_wheel_rear_left', traseiraDireita: 'car_police_wheel_rear_right' } },
  esportivo: { arquivo: `${M}cars/Sports Car by Quaternius - Gzj704DXdr.glb`, medida: 'comprimento', metros: 4.4, rotacaoY: 0, solido: true,
    rodas: { dianteiraEsquerda: 'FrontWheel_L', dianteiraDireita: 'FrontWheel_R', traseiraEsquerda: 'BackWheels', traseiraDireita: 'BackWheels' } },
  moto: { arquivo: `${M}cars/Motorcycle by Poly by Google - 5_MTCnqfUTr.glb`, medida: 'comprimento', metros: 2.2, rotacaoY: -90, solido: true,
    piloto: { modelo: 'homem', animacao: 'Man_Sitting', posicao: [0, -0.05, -0.25] } },
  vespa: { arquivo: `${M}cars/Vespa by Jasmine Roberts - blGLclvvdEM.glb`, medida: 'comprimento', metros: 1.8, rotacaoY: 0, solido: true,
    piloto: { modelo: 'mulher', animacao: 'SitIdle', posicao: [0, 0.3, -0.2] } },
  foodTruck:{ arquivo: `${M}cars/Sushi Truck by Quaternius - OgrROxABGT.glb`, medida: 'comprimento', metros: 6.5, rotacaoY: 0, solido: true },

  // -------------------------------------------------------------- outdoor --
  // O painel (material "lambert4SG") recebe a arte na frente; ver Outdoors.ts.
  // Dos três modelos de outdoor da pasta, este é o de placa reta: nos outros
  // dois o painel é em "V" e a arte ficaria torta.
  outdoor: { arquivo: `${M}outdoor/Billboard by Poly by Google - 64DATzeuVhf.glb`, medida: 'altura', metros: 10, rotacaoY: 0, solido: true, materialPainel: 'lambert4SG' },

  // ------------------------------------------------------------- barreiras --
  barreiraTransito: { arquivo: `${M}Traffic Barrier by Quaternius - cM3aJPU9NS.glb`, medida: 'altura', metros: 1.0, rotacaoY: 0, solido: true },
  barreiraConcreto: { arquivo: `${M}Concrete Barrier by J-Toastie - 5Cg2oW7EFn.glb`, medida: 'altura', metros: 0.85, rotacaoY: 0, solido: true },
  barreiraSimples: { arquivo: `${M}Barrier Single by Quaternius - wCUxgt2jSP.glb`, medida: 'comprimento', metros: 2.0, rotacaoY: 0, solido: true },
  barreiraPlastica: { arquivo: `${M}Plastic Barrier by Quaternius - QAiXMsbWRc.glb`, medida: 'comprimento', metros: 1.8, rotacaoY: 0, solido: true },
  cone: { arquivo: `${M}Road Cone by smallbigsquare - ZPhinXAGtY.glb`, medida: 'altura', metros: 0.7, rotacaoY: 0, solido: true },

  // ------------------------------------------------------------- vegetação --
  // Vegetação: sem colisor (CLAUDE.md), exceto troncos grandes, decididos na fase.
  arvoreGrande: { arquivo: `${M}Big Tree by 3Donimus - dNWh762PN-6.glb`, medida: 'altura', metros: 14, rotacaoY: 0, solido: false, observacao: 'PESADA: 35 mil triângulos. Usar poucas, perto da pista.' },
  arvore: { arquivo: `${M}Tree by Quaternius - t9KbsfYdXz.glb`, medida: 'altura', metros: 9, rotacaoY: 0, solido: false },
  arvoreCipo: { arquivo: `${M}Vine Covered Tree by Zacharylll - dlW4hGKBpiS.glb`, medida: 'altura', metros: 12, rotacaoY: 0, solido: false, observacao: 'PESADA: 53 mil triângulos em 80 malhas. Usar poucas, perto da pista.' },
  coqueiro: { arquivo: `${M}Palm tree by jeremy - bjGeBbKhAVN.glb`, medida: 'altura', metros: 9, rotacaoY: 0, solido: false },
  palmeiraBaixa: { arquivo: `${M}Palm Tree by Quaternius - A6cKJYFsIb.glb`, medida: 'altura', metros: 5, rotacaoY: 0, solido: false, observacao: 'Modelo largo e baixo (2,9 × 2,7 m): parece mais uma palmeira-anã.' },

  // ---------------------------------------------------------------- rochas --
  paredao: { arquivo: `${M}Cliff by Poly by Google - bN-rWrWm3mC.glb`, medida: 'altura', metros: 25, rotacaoY: 0, solido: true },
  rocha: { arquivo: `${M}Rock by Poly by Google - dmRuyy1VXEv.glb`, medida: 'altura', metros: 1.5, rotacaoY: 0, solido: true },
  rochaMedia: { arquivo: `${M}Rock Medium by Quaternius - s1OJ3bBzqc.glb`, medida: 'altura', metros: 2.2, rotacaoY: 0, solido: true },

  // ---------------------------------------------------------- construções --
  // O arco precisa cobrir a pista; 16 m de vão dá uns 23 m de altura.
  // O vão livre do arco é só 40% da largura (o resto são os pilares). Para a
  // pista de 12 m passar com folga, ele precisa de 38 m de largura (56 m de altura!).
  arco: { arquivo: `${M}Arch by CreativeTrio - UNjhI7hudt.glb`, medida: 'comprimento', metros: 38, rotacaoY: 0, solido: true, vaoLivre: 0.4 },
  // A ponte de treliça vem comprida em X; giramos para ficar em Z, como a pista.
  // A textura dela não veio junto com o .fbx (ficava preta): pintamos de aço.
  ponte: { arquivo: `${M}Bridge.fbx`, medida: 'comprimento', metros: 46, rotacaoY: 90, solido: false, corMaterial: 0x8b9299, observacao: 'O piso dela fica a ~50% da altura; a pista passa por cima.' },
  // O braço do poste aponta para +Z: com rotação 0 a luz fica sobre a pista.
  posteRua: { arquivo: `${M}Street Light by Quaternius - nFwrlcLvM5.glb`, medida: 'altura', metros: 7, rotacaoY: 0, solido: true, lampada: [0, 6.7, 1.05] },
  posteLampiao: { arquivo: `${M}Street Objects - Lamp Post by Ev Amitay - awUS2qoxeSa.glb`, medida: 'altura', metros: 4.5, rotacaoY: 0, solido: true, lampada: [0, 4.05, -0.1] },

  // ---------------------------------------------------------------- cidade --
  // Prédios e casas da orla de Navegantes. Colisor: caixa simples (CLAUDE.md).
  predioApartamentos: { arquivo: `${C}Apartment building by Poly by Google - 01lqee-dZAr.glb`, medida: 'altura', metros: 20, rotacaoY: 0, solido: true },
  predioVermelho: { arquivo: `${C}Building Red by J-Toastie - lbNz2dClar.glb`, medida: 'altura', metros: 14, rotacaoY: 0, solido: true },
  predioGrande: { arquivo: `${C}Large Building by Kenney - h7Jaq7bqMq.glb`, medida: 'altura', metros: 24, rotacaoY: 0, solido: true },
  predioPequeno: { arquivo: `${C}Small Building by Kenney - QjL4Fo9dU9.glb`, medida: 'altura', metros: 9, rotacaoY: 0, solido: true },
  casa: { arquivo: `${C}House by Poly by Google - 6PGyqELX8M-.glb`, medida: 'altura', metros: 6, rotacaoY: 0, solido: true },
  casa2: { arquivo: `${C}House by Quaternius - vZ1CLbWmSx.glb`, medida: 'altura', metros: 7, rotacaoY: 0, solido: true },
  bar: { arquivo: `${C}Bar by Poly by Google - cr_gfObT2-R.glb`, medida: 'altura', metros: 5, rotacaoY: 0, solido: true },

  // ------------------------------------------------------------------ porto --
  // Contêiner de 20 pés: 6,06 m. O verde é comprido em X; giramos para ficar em Z como o outro.
  conteinerVerde: { arquivo: `${M}Container Green by Quaternius - h5RUr3vlcS.glb`, medida: 'comprimento', metros: 6.06, rotacaoY: 90, solido: true },
  conteiner: { arquivo: `${M}Shipping Container by Clint Chilcott - dlBoC4Wkzp2.glb`, medida: 'comprimento', metros: 6.06, rotacaoY: 0, solido: true },
  navioConteineres: { arquivo: `${M}Container Ship by Alex Safayan - 3AmDGcCu6Ll.glb`, medida: 'comprimento', metros: 180, rotacaoY: 0, solido: false, observacao: 'Fica no horizonte: sem colisor.' },
  transatlantico: { arquivo: `${M}Cruise ship by Poly by Google - dgLCxDWhnZQ.glb`, medida: 'comprimento', metros: 250, rotacaoY: 0, solido: false, observacao: '3,8 MB. Fica no horizonte: sem colisor.' },

  // ------------------------------------------------------ pessoas e bichos --
  // Modelos com animação (esqueleto): o carregador clona com SkeletonUtils.
  homem: { arquivo: `${PI}Man by Quaternius - HMnuH5geEG.glb`, medida: 'altura', metros: 1.8, fosco: true, rotacaoY: 0, solido: false, plateia: true, observacao: '11 animações (Man_Clapping na plateia).' },
  mulher: { arquivo: `${PI}Animated Woman by Quaternius - 9kF7eTDbhO.glb`, medida: 'altura', metros: 1.7, fosco: true, rotacaoY: 0, solido: false, plateia: true, observacao: '10 animações (Jump e Idle na plateia).' },
  aventureiro: { arquivo: `${PI}Adventurer by Quaternius - 5EGWBMpuXq.glb`, medida: 'altura', metros: 1.8, fosco: true, rotacaoY: 0, solido: false, plateia: true, andarilho: true, observacao: '24 animações. Tem mochila: anda pelo acostamento (Walk/Run) e torce na plateia (Wave).' },
  aventureira: { arquivo: `${PI}Adventurer by Quaternius - ZwF0K7WBmu.glb`, medida: 'altura', metros: 1.75, fosco: true, rotacaoY: 0, solido: false, plateia: true, andarilho: true, observacao: '24 animações. Tem mochila: anda pelo acostamento (Walk/Run) e torce na plateia (Wave).' },
  mulher2: { arquivo: `${PI}Animated Woman by Quaternius - nIItLV9nxS.glb`, medida: 'altura', metros: 1.7, fosco: true, rotacaoY: 0, solido: false, plateia: true, observacao: '24 animações (Wave na plateia).' },
  moletom: { arquivo: `${PI}Hoodie Character by Quaternius - gKLBoRsyKe.glb`, medida: 'altura', metros: 1.75, fosco: true, rotacaoY: 0, solido: false, plateia: true, observacao: '24 animações (Wave na plateia).' },
  senhor: { arquivo: `${PI}Old Guy by Polygonal Mind - imEy3Tqg80.glb`, medida: 'altura', metros: 1.7, fosco: true, rotacaoY: 0, solido: false, plateia: false, observacao: 'Sem animações e em pose de "T" (braços abertos): fora da plateia, pareceria defeito.' },
  // Peça única (as rodas não giram) e sem ciclista: fica parada nas paradas de descanso.
  bicicleta: { arquivo: `${PI}Bicycle by Poly by Google - b6USSQA731J.glb`, medida: 'comprimento', metros: 1.75, rotacaoY: 0, solido: true },
  // Capivaras da orla de Navegantes, em grupos à beira da estrada. Sem animação:
  // ficam paradas, pastando. Sólidas: o carro esbarra e para (como numa pedra).
  capivara: { arquivo: `${PI}Capybara by Poly by Google - 66d-mKAgF17.glb`, medida: 'comprimento', metros: 1.25, rotacaoY: 0, solido: true },
  louvaDeus: { arquivo: `${PI}Praying Mantis by Lorenzo Cinalli - bm9Q0hKjcVC.glb`, medida: 'comprimento', metros: 4, rotacaoY: 0, solido: true },
  escorpiao: { arquivo: `${PI}Scorpion by jeremy - cJfrRPiSgA4.glb`, medida: 'comprimento', metros: 5, rotacaoY: -90, solido: true },
  aranha: { arquivo: `${PI}Spider by Quaternius - yRYJiAJyiM.glb`, medida: 'comprimento', metros: 5, fosco: true, rotacaoY: 0, solido: true },
  estatuaCervo: { arquivo: `${PI}Stag Statue by Quaternius - cKloIsNcT8.glb`, medida: 'altura', metros: 3, rotacaoY: 0, solido: true },
} as const satisfies Record<string, InfoModelo>;

export type IdModelo = keyof typeof MODELOS;
export type IdCarro = 'carro1' | 'carro2' | 'carro3';
/** Os carros do jogador, na ordem das vagas do estacionamento (carro1, carro2, carro3). */
export const IDS_CARROS: readonly IdCarro[] = ['carro1', 'carro2', 'carro3'];

// ------------------------------------------------------------ personagens --
// Quem o jogador escolhe no menu para andar a pé. Cada arquivo dá um nome
// diferente para as mesmas animações, então guardamos o nome de cada uma.
// Precisa ter parado, andando e correndo. O pulo é opcional: quem não tem
// (os modelos de 24 animações da Quaternius) usa a corrida no ar.
// Os nomes são paródias de brincadeira (gente famosa e novelas do Brasil,
// misturadas com coisas de carro). Só sugestão: troque à vontade.

/** O nome de cada animação no arquivo (a parte depois do "|": "HumanArmature|Man_Walk" → "Man_Walk"). */
export interface AnimacoesAPe {
  parado: string;
  andando: string;
  correndo: string;
  /** Opcional: sem ele, no ar o personagem usa a animação de correr. */
  pulando?: string;
}

export type IdPersonagem = 'homem' | 'mulher' | 'moletom' | 'mulher2' | 'aventureiro' | 'aventureira';
/** Na ordem em que aparecem no menu. */
export const IDS_PERSONAGENS: readonly IdPersonagem[] = ['homem', 'mulher', 'moletom', 'mulher2', 'aventureiro', 'aventureira'];

/** Os nomes das animações nos modelos de 24 animações da Quaternius (todos iguais). */
const ANIMACOES_QUATERNIUS_24: AnimacoesAPe = { parado: 'Idle', andando: 'Walk', correndo: 'Run' };

export const PERSONAGENS: Record<IdPersonagem, { nome: string; animacoes: AnimacoesAPe }> = {
  homem: { nome: 'Zeca Pneuzinho', animacoes: { parado: 'Man_Idle', andando: 'Man_Walk', correndo: 'Man_Run', pulando: 'Man_Jump' } },
  mulher: { nome: 'Ivete Sem-Gasolina', animacoes: { parado: 'Idle', andando: 'Walking', correndo: 'Running', pulando: 'Jump' } },
  moletom: { nome: 'Neymarcha Ré', animacoes: ANIMACOES_QUATERNIUS_24 },
  mulher2: { nome: 'Gretchen Freio de Mão', animacoes: ANIMACOES_QUATERNIUS_24 },
  aventureiro: { nome: 'Ayrton Semáforo', animacoes: ANIMACOES_QUATERNIUS_24 },
  aventureira: { nome: 'Tieta do Asfalto', animacoes: ANIMACOES_QUATERNIUS_24 },
};
