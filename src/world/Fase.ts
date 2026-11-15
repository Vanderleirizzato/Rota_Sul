import { Vector3, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { BIOMAS } from './biomas';
import type { Cenario } from './Cenario';
import { construirPista } from './ConstrutorPista';
import type { DadosFase } from './levels/TiposFase';
import { barreirasNasPontas, colocarObjetos } from './ObjetosFase';
import { Plateia } from './Plateia';
import { Andarilhos } from './Andarilhos';
import { Rio } from './Rio';
import { Terreno } from './Terreno';
import { Tracado } from './Tracado';
import { plantarVegetacao } from './Vegetacao';

/** O carro nasce este tanto (m) antes da linha de largada. */
const RECUO_LARGADA = 6;
/** Altura (m) acima do asfalto em que o carro aparece: ele "cai" de leve e assenta. */
const ALTURA_NASCER = 1;

/**
 * Monta uma fase a partir dos dados: traçado → pista → terreno → rio →
 * vegetação, objetos e plateia. A ordem importa: o terreno precisa da
 * pista, e as árvores precisam do terreno para saber a altura do chão.
 */
export async function construirFase(dados: DadosFase, cena: Scene, fisica: MundoFisico): Promise<Cenario> {
  const tracado = new Tracado(dados.tracado, dados.pista);
  construirPista(cena, fisica, tracado, dados.largada, dados.chegada);
  const terreno = new Terreno(cena, fisica, tracado, BIOMAS[dados.bioma], dados.rio);
  const rio = dados.rio ? new Rio(cena, fisica, tracado, dados.rio) : null;
  const plateia = new Plateia(cena, fisica, tracado, dados.plateia);
  const andarilhos = dados.andarilhos ? new Andarilhos(cena, fisica, tracado, terreno, dados) : null;

  // Tudo que depende de baixar arquivos .glb roda em paralelo.
  const [vegetacao] = await Promise.all([
    plantarVegetacao(cena, fisica, tracado, terreno, BIOMAS[dados.bioma], dados.rio?.nivel),
    colocarObjetos(cena, fisica, tracado, terreno, dados.objetos),
    barreirasNasPontas(cena, tracado, 'barreiraConcreto'),
    rio?.carregarModelos(),
    plateia.carregar(),
    andarilhos?.carregar(),
  ]);

  const i = tracado.indiceEm(dados.largada - RECUO_LARGADA);
  return {
    id: dados.id,
    nome: dados.nome,
    local: dados.local,
    largada: { posicao: tracado.pontos[i].clone().add(new Vector3(0, ALTURA_NASCER, 0)), angulo: tracado.anguloEm(i) },
    tracado,
    chegada: dados.chegada,
    luz: dados.iluminacao,
    atualizar(dt, camera, alturaEmPixels, posicaoCarro) {
      andarilhos?.atualizar(dt, camera.position, posicaoCarro);
      rio?.atualizar(dt);
      rio?.ajustarEscala(camera, alturaEmPixels);
      plateia.atualizar(dt, camera.position);
    },
    aplicarQualidade(q) {
      vegetacao.aplicarQualidade(q);
      plateia.aplicarQualidade(q);
      andarilhos?.aplicarQualidade(q);
    },
  };
}
