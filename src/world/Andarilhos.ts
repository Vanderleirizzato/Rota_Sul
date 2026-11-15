import { AnimationMixer, Box3, Quaternion, Vector3, type AnimationAction, type AnimationClip, type Object3D, type Scene } from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { obterAnimacoes, obterModelo } from './CarregadorModelos';
import type { DadosFase, Lado } from './levels/TiposFase';
import { criarSorteio } from './Ruido';
import type { ConfigQualidade } from '../config/quality';
import { ligarSombra } from './Sombras';
import type { Terreno } from './Terreno';
import type { Tracado } from './Tracado';

// =============================================================================
// ANDARILHOS: mochileiros andando pelo acostamento.
// =============================================================================
// Cada um tem um trecho da estrada e vai e volta nele, sempre no meio do
// acostamento. Quando o carro chega perto, ele "se assusta" e corre para o
// mato; depois que o carro passa, volta para o acostamento.
//
// Quem pode andar: modelos com `andarilho: true` no assets.ts (precisam ter as
// animações "Walk", "Run" e "Idle", como os personagens do Quaternius).
//
// Também monta as paradas de descanso: bicicleta encostada e alguém parado.
// =============================================================================

/** Velocidade de caminhada (m/s). Uma pessoa anda a uns 1,3 m/s (~5 km/h). */
const VELOCIDADE_ANDANDO = 1.3;
/** Velocidade para sair da frente do carro (m/s). */
const VELOCIDADE_FUGINDO = 4.5;
/** Carro a menos disto (m): hora de sair da pista. */
const DISTANCIA_SUSTO = 22;
/** Até onde a pessoa corre para fora (m depois da beira do acostamento). */
const DISTANCIA_REFUGIO = 4;
/** Áreas sem andarilhos (m em volta): largada, chegada e ponte (ninguém pode fugir para o rio). */
const FOLGA_LARGADA_CHEGADA = 60;
const FOLGA_PONTE = 45;
/** Longe da câmera, a animação para (ninguém vê, e economiza processamento). */
const DISTANCIA_ANIMAR = 140;
/** Além disto (m), nem desenha (ver Plateia.ts). */
const DISTANCIA_VER = 220;
/** Quão rápido a pessoa vira o corpo na direção em que anda (maior = mais rápido). */
const VELOCIDADE_GIRO = 6;
/** Massa da bicicleta (kg). Leve: o carro bate e ela voa longe. */
const MASSA_BICICLETA = 15;

interface Andarilho {
  objeto: Object3D;
  corpo: RAPIER.RigidBody;
  mixer: AnimationMixer | null;
  /** Animação de quando está tranquilo: "Walk" (andando) ou "Idle" (descansando). */
  andar: AnimationAction | null;
  correr: AnimationAction | null;
  /** Posição ao longo da pista (m) e sentido (+1 = para a chegada). */
  distancia: number;
  sentido: 1 | -1;
  inicio: number;
  fim: number;
  /** +1 = lado esquerdo da pista, -1 = direito. */
  sinal: 1 | -1;
  lateral: number;
  /** Distância da linha do meio quando está tranquilo, e quando foge do carro (m). */
  lateralTranquilo: number;
  lateralFuga: number;
  /** Descansando numa parada: não anda pela pista, só foge e volta. */
  descansando: boolean;
  correndo: boolean;
}

export class Andarilhos {
  private readonly lista: Andarilho[] = [];
  /** Bicicletas: a física move o corpo, e o desenho copia a posição dele. */
  private readonly bicicletas: { objeto: Object3D; corpo: RAPIER.RigidBody; meiaAltura: number }[] = [];
  private readonly giroBicicleta = new Quaternion();
  private readonly baixo = new Vector3();
  private readonly anterior = new Vector3();

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly terreno: Terreno,
    private readonly fase: DadosFase,
  ) {}

  async carregar(): Promise<void> {
    const dados = this.fase.andarilhos;
    if (!dados) return;
    const modelos = (Object.keys(MODELOS) as IdModelo[]).filter((id) => (MODELOS[id] as InfoModelo).andarilho === true);
    if (modelos.length === 0) return;
    const sorteio = criarSorteio(1985);

    const trechos = this.dividirTrechos(dados.quantidade, dados.trecho);
    await Promise.all([
      ...trechos.map(([inicio, fim]) => this.criarAndarilho(modelos, inicio, fim, sorteio)),
      ...dados.paradas.map((p) => this.criarParada(modelos, p.distancia, p.lado, sorteio)),
    ]);
  }

  atualizar(dt: number, posicaoCamera: Vector3, posicaoCarro: Vector3): void {
    const limite = DISTANCIA_ANIMAR * DISTANCIA_ANIMAR;
    const limiteVer = DISTANCIA_VER * DISTANCIA_VER;
    for (const b of this.bicicletas) this.copiarFisica(b);
    const t = this.tracado;
    for (const a of this.lista) {
      this.anterior.copy(a.objeto.position);
      const perigo = a.objeto.position.distanceTo(posicaoCarro) < DISTANCIA_SUSTO;
      const alvo = a.sinal * (perigo ? a.lateralFuga : a.lateralTranquilo);
      // Vai para o lado na velocidade de fuga (ou de volta, andando).
      const passoLateral = (perigo ? VELOCIDADE_FUGINDO : VELOCIDADE_ANDANDO) * dt;
      a.lateral += Math.max(-passoLateral, Math.min(passoLateral, alvo - a.lateral));
      // Quem descansa não tem animação de andar (o "andar" dele é o Idle):
      // então usa a corrida também para voltar ao lugar.
      a.correndo = (perigo || a.descansando) && Math.abs(alvo - a.lateral) > 0.2;

      // Com o carro perto, para de avançar e só sai da frente.
      if (!perigo && !a.descansando) {
        a.distancia += a.sentido * VELOCIDADE_ANDANDO * dt;
        if (a.distancia > a.fim) a.sentido = -1;
        if (a.distancia < a.inicio) a.sentido = 1;
      }

      const p = t.posicaoEm(a.distancia, a.lateral, a.objeto.position);
      // Fora do acostamento, quem manda na altura é o terreno.
      if (Math.abs(a.lateral) > t.meiaLarguraTotal) p.y = this.terreno.alturaEm(p.x, p.z);
      a.corpo.setNextKinematicTranslation({ x: p.x, y: p.y + 0.9, z: p.z });

      // Vira o corpo, aos poucos, para onde está andando.
      const dx = p.x - this.anterior.x;
      const dz = p.z - this.anterior.z;
      if (dx * dx + dz * dz > 1e-8) {
        const desejado = Math.atan2(dx, dz);
        const diferenca = Math.atan2(Math.sin(desejado - a.objeto.rotation.y), Math.cos(desejado - a.objeto.rotation.y));
        a.objeto.rotation.y += diferenca * Math.min(1, VELOCIDADE_GIRO * dt);
      }

      const d2 = a.objeto.position.distanceToSquared(posicaoCamera);
      a.objeto.visible = d2 < limiteVer;
      if (a.mixer && d2 < limite) {
        trocarAnimacao(a.andar, a.correr, a.correndo);
        a.mixer.update(dt);
      }
    }
  }

  /** Na qualidade Baixa, as pessoas não projetam sombra. */
  aplicarQualidade(q: ConfigQualidade): void {
    for (const a of this.lista) ligarSombra(a.objeto, q.sombraCenario);
  }

  // ---------------------------------------------------------------------------

  /**
   * O corpo físico tem o centro no MEIO da bicicleta; o modelo tem a origem
   * no chão. Por isso descemos meia altura, "para baixo" da bicicleta (que
   * pode estar tombada, então usamos o giro dela).
   */
  private copiarFisica(b: { objeto: Object3D; corpo: RAPIER.RigidBody; meiaAltura: number }): void {
    const r = b.corpo.rotation();
    const t = b.corpo.translation();
    this.giroBicicleta.set(r.x, r.y, r.z, r.w);
    this.baixo.set(0, -b.meiaAltura, 0).applyQuaternion(this.giroBicicleta);
    b.objeto.quaternion.copy(this.giroBicicleta);
    b.objeto.position.set(t.x + this.baixo.x, t.y + this.baixo.y, t.z + this.baixo.z);
  }

  /** Espalha os trechos pela pista, longe da largada, da chegada e da ponte. */
  private dividirTrechos(quantidade: number, comprimento: number): [number, number][] {
    const inicio = this.fase.largada + FOLGA_LARGADA_CHEGADA;
    const fim = this.fase.chegada - FOLGA_LARGADA_CHEGADA;
    const ponte = this.fase.rio?.distancia;
    const trechos: [number, number][] = [];
    for (let k = 0; k < quantidade; k++) {
      const centro = inicio + ((k + 0.5) / quantidade) * (fim - inicio);
      let a = centro - comprimento / 2;
      let b = centro + comprimento / 2;
      if (ponte !== undefined && b > ponte - FOLGA_PONTE && a < ponte + FOLGA_PONTE) {
        // Encostou na ponte: empurra o trecho inteiro para o lado mais perto.
        const deslocamento = centro < ponte ? ponte - FOLGA_PONTE - b : ponte + FOLGA_PONTE - a;
        a += deslocamento;
        b += deslocamento;
      }
      trechos.push([a, b]);
    }
    return trechos;
  }

  private async criarAndarilho(modelos: IdModelo[], inicio: number, fim: number, sorteio: () => number): Promise<void> {
    const id = modelos[Math.floor(sorteio() * modelos.length)];
    const [objeto, animacoes] = await Promise.all([obterModelo(id), obterAnimacoes(id)]);
    this.cena.add(objeto);
    const sinal = sorteio() < 0.5 ? 1 : -1;
    const t = this.tracado;

    const mixer = animacoes.length > 0 ? new AnimationMixer(objeto) : null;
    const andar = mixer ? acao(mixer, animacoes, 'walk') : null;
    const correr = mixer ? acao(mixer, animacoes, 'run') : null;
    andar?.play();
    if (correr) {
      correr.play();
      correr.setEffectiveWeight(0);
    }
    mixer?.setTime(sorteio() * 2);

    // Tranquilo, anda no meio do acostamento.
    const meioAcostamento = t.pista.largura / 2 + t.pista.acostamento / 2;
    const a: Andarilho = {
      objeto,
      corpo: this.fisica.criarCapsulaCinematica(0.3, 0.6),
      mixer,
      andar,
      correr,
      distancia: inicio + sorteio() * (fim - inicio),
      sentido: sorteio() < 0.5 ? 1 : -1,
      inicio,
      fim,
      sinal,
      lateral: sinal * meioAcostamento,
      lateralTranquilo: meioAcostamento,
      lateralFuga: t.meiaLarguraTotal + DISTANCIA_REFUGIO,
      descansando: false,
      correndo: false,
    };
    t.posicaoEm(a.distancia, a.lateral, objeto.position);
    objeto.rotation.y = t.anguloEm(t.indiceEm(a.distancia)) + (a.sentido < 0 ? Math.PI : 0);
    this.lista.push(a);
  }

  /** Bicicleta encostada na beira da estrada e um mochileiro descansando ao lado. */
  private async criarParada(modelos: IdModelo[], distancia: number, lado: Lado, sorteio: () => number): Promise<void> {
    const t = this.tracado;
    const i = t.indiceEm(distancia);
    const sinal = lado === 'esquerda' ? 1 : -1;
    const angulo = t.anguloEm(i);

    const bicicleta = await obterModelo('bicicleta');
    const pBici = t.pontoAoLado(distancia, lado, t.meiaLarguraTotal + 1.8);
    pBici.y = this.terreno.alturaEm(pBici.x, pBici.z);
    bicicleta.position.copy(pBici);
    bicicleta.rotation.y = angulo + (sorteio() - 0.5) * 0.4;
    this.cena.add(bicicleta);
    // Corpo dinâmico e leve: se o carro bater, ela sai voando (não é um poste).
    const tamanho = new Box3().setFromObject(bicicleta).getSize(new Vector3());
    const meiaAltura = tamanho.y / 2;
    const corpo = this.fisica.criarCaixaDinamica(
      { x: pBici.x, y: pBici.y + meiaAltura + 0.02, z: pBici.z },
      { x: 0.25, y: meiaAltura, z: tamanho.z / 2 },
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), bicicleta.rotation.y),
      MASSA_BICICLETA,
    );
    this.bicicletas.push({ objeto: bicicleta, corpo, meiaAltura });

    // O mochileiro que descansa é um andarilho que não anda: fica parado ao
    // lado da bicicleta e, se o carro vem, corre para o mato como os outros.
    // (Um poste fixo ali faria o carro parar seco ao bater nele.)
    const id = modelos[Math.floor(sorteio() * modelos.length)];
    const [pessoa, animacoes] = await Promise.all([obterModelo(id), obterAnimacoes(id)]);
    const lateralDescanso = t.meiaLarguraTotal + 2.6;
    const distanciaPessoa = distancia + 1.5;
    t.posicaoEm(distanciaPessoa, sinal * lateralDescanso, pessoa.position);
    pessoa.position.y = this.terreno.alturaEm(pessoa.position.x, pessoa.position.z);
    // Olhando para a estrada, vendo os carros passarem.
    const paraPista = t.esquerdas[i].clone().multiplyScalar(-sinal);
    pessoa.rotation.y = Math.atan2(paraPista.x, paraPista.z);
    this.cena.add(pessoa);

    const mixer = animacoes.length > 0 ? new AnimationMixer(pessoa) : null;
    const parado = mixer ? acao(mixer, animacoes, 'idle') : null;
    const correr = mixer ? acao(mixer, animacoes, 'run') : null;
    parado?.play();
    if (correr) {
      correr.play();
      correr.setEffectiveWeight(0);
    }
    mixer?.setTime(sorteio() * 3);
    this.lista.push({
      objeto: pessoa,
      corpo: this.fisica.criarCapsulaCinematica(0.3, 0.6),
      mixer,
      andar: parado,
      correr,
      distancia: distanciaPessoa,
      sentido: 1,
      inicio: distanciaPessoa,
      fim: distanciaPessoa,
      sinal,
      lateral: sinal * lateralDescanso,
      lateralTranquilo: lateralDescanso,
      lateralFuga: lateralDescanso + DISTANCIA_REFUGIO + 1,
      descansando: true,
      correndo: false,
    });
  }
}

/** Ação de animação pelo nome exato depois do "|" (ex.: "CharacterArmature|Walk" → "walk"). */
function acao(mixer: AnimationMixer, animacoes: AnimationClip[], nome: string): AnimationAction | null {
  const clipe = animacoes.find((a) => a.name.toLowerCase().split('|').pop() === nome);
  return clipe ? mixer.clipAction(clipe) : null;
}

/** Mistura suave entre andar e correr (as duas tocam juntas; muda só o "peso" de cada uma). */
function trocarAnimacao(andar: AnimationAction | null, correr: AnimationAction | null, correndo: boolean): void {
  if (!andar || !correr) return;
  const alvo = correndo ? 1 : 0;
  const atual = correr.getEffectiveWeight();
  const novo = atual + (alvo - atual) * 0.15;
  correr.setEffectiveWeight(novo);
  andar.setEffectiveWeight(1 - novo);
}
