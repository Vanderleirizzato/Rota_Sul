import { MathUtils, Quaternion, Vector3, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { BIOMAS } from './biomas';
import type { Cenario, EstadoCarro } from './Cenario';
import { construirPista } from './ConstrutorPista';
import type { DadosFase, LugarFase, PontoTracado } from './levels/TiposFase';
import { barreirasNasPontas, colocarObjetos } from './ObjetosFase';
import { Plateia } from './Plateia';
import { Andarilhos } from './Andarilhos';
import { Rio } from './Rio';
import { Mar } from './Mar';
import { colocarFileiras } from './Fileiras';
import { dentroDePatio } from './Patios';
import { MARGEM_TERRENO, Terreno } from './Terreno';
import { Tracado, type Prolongamento } from './Tracado';
import { plantarVegetacao } from './Vegetacao';
import { colocarBarreiras } from './Barreiras';
import { ObjetosSoltos } from './ObjetosSoltos';
import { Trafego } from './Trafego';
import { colocarOutdoors } from './Outdoors';
import { colocarPortico } from './Portico';
import { Insetos } from './Insetos';
import { Trofeu } from './Trofeu';
import { Bloqueios } from './Bloqueios';
import { colocarBairros, patioDoBairro } from './Bairro';
import { colocarLimites, RECUO_LIMITES } from './LimitesMundo';
import { Pecas } from './Pecas';
import { tuning } from '../config/tuning';

/** O carro nasce este tanto (m) antes da linha de largada. */
const RECUO_LARGADA = 6;
/** Altura (m) acima do asfalto em que o carro aparece: ele "cai" de leve e assenta. */
const ALTURA_NASCER = 1;

/**
 * Monta uma fase a partir dos dados: traçado → pista → terreno → rio/mar →
 * vegetação, objetos, barreiras, plateia e trânsito. A ordem importa: o terreno precisa da
 * pista, e as árvores precisam do terreno para saber a altura do chão.
 */
export async function construirFase(dados: DadosFase, cena: Scene, fisica: MundoFisico): Promise<Cenario> {
  const tracado = new Tracado(dados.tracado, dados.pista, prolongamentos(dados.tracado));
  construirPista(cena, fisica, tracado, dados.largada, dados.chegada);
  // Cada bairro também é um pátio: chão plano onde o carro anda livre.
  const bairros = dados.bairros ?? [];
  const patios = [...(dados.patios ?? []), ...bairros.map(patioDoBairro)];
  const terreno = new Terreno(cena, fisica, tracado, BIOMAS[dados.bioma], { rio: dados.rio, mar: dados.mar, patios });
  // No passeio o mapa é livre: paredes invisíveis na borda seguram o carro.
  colocarLimites(fisica, terreno);
  // Onde tem água: o rio e/ou o mar (cada um com a altura da sua superfície).
  const rio = dados.rio ? new Rio(cena, fisica, tracado, dados.rio) : null;
  const mar = dados.mar ? new Mar(cena, tracado, dados.mar) : null;
  const plateia = new Plateia(cena, fisica, tracado, dados.plateia);
  const andarilhos = dados.andarilhos ? new Andarilhos(cena, fisica, tracado, terreno, dados) : null;
  const soltos = new ObjetosSoltos(cena, fisica, tracado, terreno, dados.soltos ?? []);
  const trafego = dados.trafego ? new Trafego(cena, fisica, tracado, dados.trafego) : null;
  // Easter eggs (cada um só existe se a fase tiver os dados dele).
  if (dados.portico) colocarPortico(cena, fisica, tracado, dados.portico);
  const insetos = dados.insetos ? new Insetos(cena, tracado, terreno, dados.insetos) : null;
  const trofeu = dados.trofeu ? new Trofeu(cena, tracado, terreno, dados.trofeu) : null;
  // Os carros do jogador e o começo a pé: medidos agora, porque o bairro
  // precisa deixar essas vagas livres.
  const vagas = dados.estacionamento.vagas.map((v) => lugarNoChao(tracado, terreno, v, ALTURA_NASCER));
  const inicioAPe = lugarNoChao(tracado, terreno, dados.estacionamento.inicioAPe, 0);
  const pecas = new Pecas(cena, tracado, terreno, dados.id, dados.pecas ?? []);

  // Tudo que depende de baixar arquivos .glb roda em paralelo.
  const [vegetacao, , postes, carrosBairro, bloqueios] = await Promise.all([
    // Abaixo da água (rio ou mar) nada nasce.
    plantarVegetacao(cena, fisica, tracado, terreno, BIOMAS[dados.bioma], dados.rio?.nivel ?? dados.mar?.nivel),
    colocarObjetos(cena, fisica, tracado, terreno, dados.objetos),
    colocarFileiras(cena, fisica, tracado, terreno, dados.fileiras ?? []),
    colocarBairros(cena, fisica, tracado, terreno, bairros, vagas.map((v) => v.posicao)),
    // Fim da estrada: "pista interditada" nas duas pontas.
    Bloqueios.criar(cena, fisica, tracado),
    barreirasNasPontas(cena, tracado, 'barreiraConcreto'),
    rio?.carregarModelos(),
    plateia.carregar(),
    andarilhos?.carregar(),
    colocarBarreiras(cena, fisica, tracado, dados.barreiras ?? []),
    soltos.carregar(),
    trafego?.carregar(),
    colocarOutdoors(cena, fisica, tracado, terreno, dados.outdoors ?? []),
    insetos?.carregar(),
  ]);

  const i = tracado.indiceEm(dados.largada - RECUO_LARGADA);
  // O carro como estava no último passo de física (as pessoas usam a cada quadro).
  const carro: EstadoCarro = { posicao: new Vector3(), rotacao: new Quaternion(), velocidade: new Vector3() };
  return {
    id: dados.id,
    nome: dados.nome,
    local: dados.local,
    largada: { posicao: tracado.pontos[i].clone().add(new Vector3(0, ALTURA_NASCER, 0)), angulo: tracado.anguloEm(i) },
    vagas,
    inicioAPe,
    // Do trânsito ou estacionado num bairro: vale o que estiver mais perto.
    carroDisponivel(p, raio) {
      const doTransito = trafego?.disponivel(p, raio) ?? null;
      const doBairro = carrosBairro.disponivel(p, raio);
      if (!doTransito) return doBairro;
      if (!doBairro) return doTransito;
      return doTransito.distancia < doBairro.distancia ? doTransito : doBairro;
    },
    tracado,
    chegada: dados.chegada,
    luz: dados.iluminacao,
    nivelMar: dados.mar?.nivel ?? null,
    areaLivre: (distancia, lateral, fora) => dentroDePatio(patios, distancia, lateral, fora),
    // Na água = o chão ali está abaixo da superfície E o carro desceu até ela.
    // (Em cima da ponte o chão está abaixo da água, mas o carro está lá no alto.)
    naAgua: (p) => {
      const abaixo = (nivel: number): boolean => terreno.alturaEm(p.x, p.z) < nivel && p.y < nivel + tuning.reposicionamento.alturaNoMar;
      // O rio só conta dentro da faixa de água dele; o mar cobre tudo abaixo do nível.
      return (rio !== null && rio.cobre(p.x, p.z) && abaixo(dados.rio?.nivel ?? 0)) || (dados.mar !== undefined && abaixo(dados.mar.nivel));
    },
    alturaChao: (x, z) => terreno.alturaEm(x, z),
    atualizar(dt, camera, alturaEmPixels, posicaoCarro, alfa) {
      mar?.atualizar(dt);
      trafego?.atualizar(dt, posicaoCarro, alfa);
      soltos.atualizar(camera.position);
      postes.atualizar();
      andarilhos?.atualizar(dt, camera.position, carro);
      insetos?.atualizar(dt, carro);
      trofeu?.atualizar(dt, carro);
      pecas.atualizar(dt, carro);
      rio?.atualizar(dt);
      bloqueios.atualizar(dt);
      rio?.ajustarEscala(camera, alturaEmPixels);
      plateia.atualizar(dt, camera.position);
    },
    passoFisica(dt, estado) {
      carro.posicao.copy(estado.posicao);
      carro.rotacao.copy(estado.rotacao);
      carro.velocidade.copy(estado.velocidade);
      trafego?.passo(dt, carro);
      postes.passo(dt, carro);
    },
    colherImpactos: () => ({
      plastico: soltos.colherImpacto(),
      macio: Math.max(andarilhos?.colherImpacto() ?? 0, insetos?.colherImpacto() ?? 0),
      metal: postes.colherImpacto(),
    }),
    pegouTrofeu: () => trofeu?.pegou() ?? false,
    tempoParaLiberar: dados.tempoParaLiberar ?? null,
    totalPecas: pecas.total,
    colherPeca: () => pecas.colher(),
    reiniciar() {
      trofeu?.reiniciar();
      soltos.reiniciar();
      trafego?.reiniciar();
      postes.reiniciar();
    },
    aplicarQualidade(q) {
      vegetacao.aplicarQualidade(q);
      plateia.aplicarQualidade(q);
      andarilhos?.aplicarQualidade(q);
    },
  };
}

/**
 * Um lugar dos dados (distância, lado, afastamento, rotação) no mundo: a
 * posição no chão (mais `acima` metros) e o ângulo.
 */
function lugarNoChao(tracado: Tracado, terreno: Terreno, l: LugarFase, acima: number): { posicao: Vector3; angulo: number } {
  const posicao = tracado.pontoAoLado(l.distancia, l.lado, l.afastamento);
  // Na pista vale a altura do asfalto (o terreno fica um pouco abaixo dele).
  const naPista = l.afastamento <= tracado.meiaLarguraTotal;
  const i = tracado.indiceEm(l.distancia);
  posicao.y = (naPista ? tracado.alturaSuperficie(i, 0) : terreno.alturaEm(posicao.x, posicao.z)) + acima;
  return { posicao, angulo: tracado.anguloEm(i) + MathUtils.degToRad(l.rotacao ?? 0) };
}

/** Distância (m) entre o bloqueio no fim da estrada e a parede invisível da borda do mundo. */
const BLOQUEIO_ANTES_DA_BORDA = 40;

/**
 * Quanto a estrada continua reta em cada ponta: até perto da borda do mundo,
 * onde fica o bloqueio "pista interditada". Assim ela some no horizonte em
 * vez de acabar do nada no meio do mato.
 */
function prolongamentos(pontos: PontoTracado[]): Prolongamento {
  // O mesmo retângulo do terreno (pista + margem), recolhido até antes das paredes.
  const folga = MARGEM_TERRENO - RECUO_LIMITES - BLOQUEIO_ANTES_DA_BORDA;
  const xs = pontos.map((p) => p[0]);
  const zs = pontos.map((p) => p[2]);
  const caixa = { minX: Math.min(...xs) - folga, maxX: Math.max(...xs) + folga, minZ: Math.min(...zs) - folga, maxZ: Math.max(...zs) + folga };
  const n = pontos.length;
  return {
    antes: ateABorda(pontos[0], pontos[1], caixa),
    depois: ateABorda(pontos[n - 1], pontos[n - 2], caixa),
  };
}

/** Quantos metros andando reto de `vizinho` para `ponta` (e além) até sair da caixa. */
function ateABorda(ponta: PontoTracado, vizinho: PontoTracado, c: { minX: number; maxX: number; minZ: number; maxZ: number }): number {
  const dx = ponta[0] - vizinho[0];
  const dz = ponta[2] - vizinho[2];
  const tamanho = Math.hypot(dx, dz);
  const ux = dx / tamanho;
  const uz = dz / tamanho;
  // Distância até cada parede da caixa na direção em que a estrada segue; vale a mais perto.
  const ateX = ux > 0 ? (c.maxX - ponta[0]) / ux : ux < 0 ? (c.minX - ponta[0]) / ux : Infinity;
  const ateZ = uz > 0 ? (c.maxZ - ponta[2]) / uz : uz < 0 ? (c.minZ - ponta[2]) / uz : Infinity;
  return Math.max(0, Math.min(ateX, ateZ));
}
