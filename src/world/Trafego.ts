import { AnimationMixer, Box3, Vector3, type Object3D, type Scene } from 'three';
import { clone as clonarComEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { tuning } from '../config/tuning';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { obterAnimacoes, obterModelo } from './CarregadorModelos';
import type { DadosTrafego, TipoVeiculo } from './levels/TiposFase';
import type { Tracado } from './Tracado';
import type { EstadoCarro } from './Cenario';
import { CARRO_JOGADOR } from './ContatoCarro';
import { VeiculoTrafego, type MeiasMedidas, type Sentido } from './VeiculoTrafego';

// =============================================================================
// TRÂNSITO
// =============================================================================
// Uma estrada de 5 km com trânsito de verdade teria centenas de veículos. Mas
// o jogador só enxerga uns 300 m em volta dele. Então só existem os veículos
// PERTO do jogador: eles nascem longe (fora da vista, depois da neblina) e
// somem quando ficam muito para trás. Parece uma estrada cheia; na memória,
// são só uns 10.
// =============================================================================

/** Distância mínima (m) entre dois veículos na mesma faixa na hora de nascer. */
const FOLGA_NASCER = 30;
/** Parte (0 a 1) dos veículos do mesmo sentido que nascem ATRÁS do jogador (os mais rápidos o alcançam). */
const FRACAO_ATRAS = 0.25;
/** O colisor fica um pouco menor que o desenho (espelhos e para-choques não "batem" no ar). */
const ENCOLHER_COLISOR = 0.92;

/** Margem (m) para "vai bater": um pouco antes do contato de verdade. */
const MARGEM_CONTATO = 0.3;
/** Destroço que caiu além disto (m) abaixo da pista (no mar, barranco abaixo) some. */
const QUEDA_SUMIR = 25;

/** O que guardamos de cada tipo de veículo, carregado uma vez. */
interface ModeloVeiculo {
  prototipo: Object3D;
  meias: MeiasMedidas;
  /** Moto ou lambreta (tem piloto): tomba quando atingida. */
  duasRodas: boolean;
}

export class Trafego {
  private readonly modelos = new Map<IdModelo, ModeloVeiculo>();
  private readonly veiculos: VeiculoTrafego[] = [];
  /** Desenhos guardados para reaproveitar (clonar de novo custaria mais). */
  private readonly guardados = new Map<IdModelo, Object3D[]>();
  private readonly pesoTotal: number;
  // Onde o jogador está na pista (atualizado a cada quadro).
  private distanciaJogador = 0;
  private lateralJogador = 0;
  /** Velocidade do jogador AO LONGO da pista (m/s): positiva indo para a chegada. */
  private velocidadeJogador = 0;
  private dicaProjecao: number | undefined;
  private readonly futuroJogador = new Vector3();

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly dados: DadosTrafego,
  ) {
    this.pesoTotal = dados.tipos.reduce((soma, t) => soma + t.peso, 0);
  }

  /** Baixa os modelos e mede cada um. Motos e lambretas ganham o piloto sentado. */
  async carregar(): Promise<void> {
    await Promise.all(
      this.dados.tipos.map(async ({ modelo }) => {
        const prototipo = await obterModelo(modelo);
        const caixa = new Box3().setFromObject(prototipo, true);
        let altura = caixa.max.y;
        const info: InfoModelo = MODELOS[modelo];
        const piloto = info.piloto;
        if (piloto) {
          await this.montarPiloto(prototipo, piloto);
          // A pessoa sentada sobe a "altura" do veículo para o colisor.
          altura = Math.max(altura, piloto.posicao[1] + 1.45);
        }
        const tamanho = caixa.getSize(new Vector3());
        this.modelos.set(modelo, {
          prototipo,
          meias: { x: (tamanho.x / 2) * ENCOLHER_COLISOR, y: altura / 2, z: (tamanho.z / 2) * ENCOLHER_COLISOR },
          duasRodas: piloto !== undefined,
        });
      }),
    );
  }

  /**
   * Um passo de física.
   * 1) Batidas: quem está a ponto de levar uma (do jogador ou de um destroço)
   *    é "solto" ANTES do contato. Se fosse depois, o primeiro instante da
   *    batida já teria sido contra um veículo de peso infinito (um muro).
   * 2) Cada veículo olha o que está à frente NA FAIXA DELE (outro veículo,
   *    um destroço, o jogador) e decide se acelera ou freia.
   */
  passo(dt: number, carro: EstadoCarro): void {
    this.detectarBatidas(dt, carro);
    for (const v of this.veiculos) {
      if (v.solto) {
        v.passo(dt, Infinity, 0);
        continue;
      }
      let folga = Infinity;
      let velocidadeDaFrente = v.cruzeiro;
      const olhar = (distancia: number, lateral: number, meiaLargura: number, meioComprimento: number, velocidadeNaPista: number): void => {
        if (Math.abs(lateral - v.lateral) > v.meias.x + meiaLargura) return; // outra faixa
        const aFrente = (distancia - v.distancia) * v.sentido;
        if (aFrente <= 0) return;
        const livre = aFrente - v.meias.z - meioComprimento;
        if (livre < folga) {
          folga = livre;
          // Velocidade de quem está à frente, medida no MEU sentido.
          velocidadeDaFrente = velocidadeNaPista * v.sentido;
        }
      };
      for (const outro of this.veiculos) {
        if (outro !== v) olhar(outro.distancia, outro.lateralAtual, outro.meias.x, outro.meias.z, outro.velocidadeNaPista);
      }
      olhar(this.distanciaJogador, this.lateralJogador, CARRO_JOGADOR.meiaLargura, CARRO_JOGADOR.meioComprimento, this.velocidadeJogador);
      v.passo(dt, folga, velocidadeDaFrente);
    }
  }

  /** A cada quadro: acompanha o jogador, cria/apaga veículos e desenha. */
  atualizar(dt: number, posicaoJogador: Vector3, alfa: number): void {
    this.acompanharJogador(dt, posicaoJogador);
    this.apagarDistantes();
    // Um por quadro no máximo: espalha o custo de criar ao longo do tempo.
    if (this.veiculos.length < this.dados.quantidade) this.tentarCriar();
    for (const v of this.veiculos) v.desenhar(alfa);
  }

  /** Corrida reiniciada (tecla T): apaga todos; eles renascem em volta da largada. */
  reiniciar(): void {
    while (this.veiculos.length > 0) this.apagar(this.veiculos.length - 1);
    this.dicaProjecao = undefined;
  }

  // ---------------------------------------------------------------------------

  /** Solta quem vai levar uma batida no próximo instante (ver passo). */
  private detectarBatidas(dt: number, carro: EstadoCarro): void {
    const rapidezJogador = carro.velocidade.length();
    const futuro = this.futuroJogador.copy(carro.posicao).addScaledVector(carro.velocidade, dt);
    for (const v of this.veiculos) {
      if (v.solto) continue;
      // Jogador: olha onde ele estará no próximo passo, com margem pela velocidade dos dois.
      const margem = MARGEM_CONTATO + (rapidezJogador + v.velocidade) * dt;
      if (v.encostou(futuro, CARRO_JOGADOR.meiaLargura + margem, CARRO_JOGADOR.meioComprimento + margem)) {
        this.soltar(v);
        continue;
      }
      // Engavetamento: um destroço encostando num veículo também o solta.
      for (const outro of this.veiculos) {
        if (!outro.solto || outro === v) continue;
        if (v.encostou(outro.posicao, outro.meias.x + MARGEM_CONTATO, outro.meias.z + MARGEM_CONTATO)) {
          this.soltar(v);
          break;
        }
      }
    }
  }

  private soltar(v: VeiculoTrafego): void {
    v.soltar(this.fisica, this.modelos.get(v.modelo)?.duasRodas ?? false);
  }

  private acompanharJogador(dt: number, posicao: Vector3): void {
    const p = this.tracado.projetar(posicao, this.dicaProjecao);
    this.dicaProjecao = p.indice;
    const andou = p.distancia - this.distanciaJogador;
    // Um salto grande é reposicionamento (tecla R/T), não velocidade.
    const velocidade = Math.abs(andou) > 30 || dt <= 0 ? 0 : andou / dt;
    // Média suave: a projeção oscila um pouco de um quadro para outro.
    this.velocidadeJogador += (velocidade - this.velocidadeJogador) * Math.min(1, dt * 5);
    this.distanciaJogador = p.distancia;
    this.lateralJogador = p.lateral;
  }

  private apagarDistantes(): void {
    const t = tuning.trafego;
    for (let k = this.veiculos.length - 1; k >= 0; k--) {
      const v = this.veiculos[k];
      const longe = Math.abs(v.distancia - this.distanciaJogador);
      // Quem parou no fim do trecho some assim que sair da vista.
      const caiu = v.solto && v.posicao.y < this.tracado.alturaSuperficie(this.tracado.indiceEm(v.distancia), 0) - QUEDA_SUMIR;
      if (longe > t.distanciaSumir || (v.noFim && longe > t.distanciaCriar * 0.6) || caiu) this.apagar(k);
    }
  }

  private tentarCriar(): void {
    const t = tuning.trafego;
    const tipo = this.sortearTipo();
    const sentido: Sentido = Math.random() < this.dados.mesmoSentido ? 1 : -1;
    // Contramão: sempre à frente (vem na direção do jogador). Mesmo sentido:
    // quase sempre à frente, às vezes atrás (os mais rápidos alcançam você).
    const atras = sentido === 1 && Math.random() < FRACAO_ATRAS;
    const afastamento = t.distanciaCriar + Math.random() * (t.distanciaSumir - t.distanciaCriar - 30);
    const distancia = this.distanciaJogador + (atras ? -afastamento : afastamento);
    if (distancia < this.dados.inicio || distancia > this.dados.fim) return;
    // Faixa ocupada ali perto: tenta de novo no próximo quadro.
    if (this.veiculos.some((v) => v.sentido === sentido && Math.abs(v.distancia - distancia) < FOLGA_NASCER)) return;
    this.criar(tipo, distancia, sentido);
  }

  private criar(tipo: TipoVeiculo, distancia: number, sentido: Sentido): void {
    const modelo = this.modelos.get(tipo.modelo);
    if (!modelo) return;
    const objeto = this.guardados.get(tipo.modelo)?.pop() ?? clonarComEsqueleto(modelo.prototipo);
    this.cena.add(objeto);
    const [min, max] = tipo.velocidade;
    const cruzeiro = (min + Math.random() * (max - min)) / 3.6;
    const corpo = this.fisica.criarVeiculoCinematico(modelo.meias);
    const v = new VeiculoTrafego(tipo.modelo, objeto, corpo, modelo.meias, this.tracado, distancia, sentido, cruzeiro, [
      this.dados.inicio,
      this.dados.fim,
    ]);
    v.desenhar(1);
    this.veiculos.push(v);
  }

  private apagar(k: number): void {
    const v = this.veiculos[k];
    this.cena.remove(v.objeto);
    this.fisica.remover(v.corpo);
    const lista = this.guardados.get(v.modelo) ?? [];
    lista.push(v.objeto);
    this.guardados.set(v.modelo, lista);
    this.veiculos.splice(k, 1);
  }

  /** Sorteio com peso: tipos de peso maior saem mais vezes. */
  private sortearTipo(): TipoVeiculo {
    let r = Math.random() * this.pesoTotal;
    for (const tipo of this.dados.tipos) {
      r -= tipo.peso;
      if (r <= 0) return tipo;
    }
    return this.dados.tipos[this.dados.tipos.length - 1];
  }

  /**
   * Põe a pessoa sentada no veículo. A animação de "sentado" é tocada uma vez
   * e congelada: os ossos ficam na pose e cada cópia do veículo (clonada
   * depois) já nasce com o piloto nessa pose, sem gastar nada por quadro.
   */
  private async montarPiloto(veiculo: Object3D, piloto: { modelo: string; animacao: string; posicao: [number, number, number] }): Promise<void> {
    if (!(piloto.modelo in MODELOS)) {
      console.warn(`Piloto "${piloto.modelo}" não existe no manifesto; o veículo vai sem ninguém.`);
      return;
    }
    const id = piloto.modelo as IdModelo;
    const pessoa = await obterModelo(id);
    const clipe = (await obterAnimacoes(id)).find((c) => c.name.split('|').pop() === piloto.animacao);
    if (clipe) {
      const mixer = new AnimationMixer(pessoa);
      mixer.clipAction(clipe).play();
      // Um pouco depois do começo: algumas animações começam com a pessoa ainda descendo.
      mixer.update(clipe.duration * 0.6);
    } else {
      console.warn(`Animação "${piloto.animacao}" não encontrada em ${id}; o piloto fica de pé.`);
    }
    pessoa.position.set(...piloto.posicao);
    veiculo.add(pessoa);
  }
}
