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
  /** Cor que substitui o material original (para modelos cuja textura não veio junto). */
  corMaterial?: number;
  /**
   * Postes: onde fica a lâmpada (m), no modelo já no tamanho do jogo e olhando
   * para +Z (a pista). Medido com o script de medição; ver fileiras "acesas".
   */
  lampada?: [x: number, y: number, z: number];
}

const M = 'models/';
const PI = `${M}pessoas e Insetos/`;
const C = `${M}city/`;

export const MODELOS = {
  // ---------------------------------------------------------------- carros --
  carro1: {
    arquivo: `${M}Carro1.glb`,
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
  carro2: {
    arquivo: `${M}Carro2.glb`,
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
  onibus: { arquivo: `${M}Bus by Poly by Google - 4CPpvEmrMoF.glb`, medida: 'comprimento', metros: 12, rotacaoY: 0, solido: true, observacao: 'Conferir para que lado aponta (Etapa 4).' },
  taxi: { arquivo: `${M}Taxi by Quaternius - x43lOScTpN.glb`, medida: 'comprimento', metros: 4.5, rotacaoY: 0, solido: true, observacao: 'Conferir para que lado aponta (Etapa 4).' },
  caminhao: { arquivo: `${M}Truck by Quaternius - cXw6oiFtZ8.glb`, medida: 'comprimento', metros: 7, rotacaoY: 0, solido: true, observacao: 'Conferir para que lado aponta (Etapa 4).' },
  foodTruck: { arquivo: `${M}Sushi Truck by Quaternius - OgrROxABGT.glb`, medida: 'comprimento', metros: 6.5, rotacaoY: 0, solido: true, observacao: 'Altura original 7,3 m para 8 m de comprimento: deve ter algo alto no teto. Conferir.' },

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
  homem: { arquivo: `${PI}Man by Quaternius - HMnuH5geEG.glb`, medida: 'altura', metros: 1.8, rotacaoY: 0, solido: false, plateia: true, observacao: '11 animações (Man_Clapping na plateia).' },
  mulher: { arquivo: `${PI}Animated Woman by Quaternius - 9kF7eTDbhO.glb`, medida: 'altura', metros: 1.7, rotacaoY: 0, solido: false, plateia: true, observacao: '10 animações (Jump e Idle na plateia).' },
  aventureiro: { arquivo: `${PI}Adventurer by Quaternius - 5EGWBMpuXq.glb`, medida: 'altura', metros: 1.8, rotacaoY: 0, solido: false, plateia: true, andarilho: true, observacao: '24 animações. Tem mochila: anda pelo acostamento (Walk/Run) e torce na plateia (Wave).' },
  aventureira: { arquivo: `${PI}Adventurer by Quaternius - ZwF0K7WBmu.glb`, medida: 'altura', metros: 1.75, rotacaoY: 0, solido: false, plateia: true, andarilho: true, observacao: '24 animações. Tem mochila: anda pelo acostamento (Walk/Run) e torce na plateia (Wave).' },
  mulher2: { arquivo: `${PI}Animated Woman by Quaternius - nIItLV9nxS.glb`, medida: 'altura', metros: 1.7, rotacaoY: 0, solido: false, plateia: true, observacao: '24 animações (Wave na plateia).' },
  moletom: { arquivo: `${PI}Hoodie Character by Quaternius - gKLBoRsyKe.glb`, medida: 'altura', metros: 1.75, rotacaoY: 0, solido: false, plateia: true, observacao: '24 animações (Wave na plateia).' },
  senhor: { arquivo: `${PI}Old Guy by Polygonal Mind - imEy3Tqg80.glb`, medida: 'altura', metros: 1.7, rotacaoY: 0, solido: false, plateia: false, observacao: 'Sem animações e em pose de "T" (braços abertos): fora da plateia, pareceria defeito.' },
  // Peça única (as rodas não giram) e sem ciclista: fica parada nas paradas de descanso.
  bicicleta: { arquivo: `${PI}Bicycle by Poly by Google - b6USSQA731J.glb`, medida: 'comprimento', metros: 1.75, rotacaoY: 0, solido: true },
  // Capivaras da orla de Navegantes, em grupos à beira da estrada. Sem animação:
  // ficam paradas, pastando. Sólidas: o carro esbarra e para (como numa pedra).
  capivara: { arquivo: `${PI}Capybara by Poly by Google - 66d-mKAgF17.glb`, medida: 'comprimento', metros: 1.25, rotacaoY: 0, solido: true },
  louvaDeus: { arquivo: `${PI}Praying Mantis by Lorenzo Cinalli - bm9Q0hKjcVC.glb`, medida: 'comprimento', metros: 4, rotacaoY: 0, solido: true, observacao: 'Inseto gigante do easter egg (Etapa 5).' },
  escorpiao: { arquivo: `${PI}Scorpion by jeremy - cJfrRPiSgA4.glb`, medida: 'comprimento', metros: 5, rotacaoY: 0, solido: true, observacao: 'Comprido em X: deve precisar de rotacaoY ±90 (Etapa 5).' },
  aranha: { arquivo: `${PI}Spider by Quaternius - yRYJiAJyiM.glb`, medida: 'comprimento', metros: 5, rotacaoY: 0, solido: true, observacao: '5 animações.' },
  estatuaCervo: { arquivo: `${PI}Stag Statue by Quaternius - cKloIsNcT8.glb`, medida: 'altura', metros: 3, rotacaoY: 0, solido: true },
} as const satisfies Record<string, InfoModelo>;

export type IdModelo = keyof typeof MODELOS;
export type IdCarro = 'carro1' | 'carro2';
