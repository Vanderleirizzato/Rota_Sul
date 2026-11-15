import { AnimationMixer, Matrix4, Quaternion, Vector3, type AnimationClip, type Object3D, type Scene } from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { MODELOS, type IdModelo, type InfoModelo } from './assets';
import { obterAnimacoes, obterModelo } from './CarregadorModelos';
import { criarInstancias } from './Instancias';
import type { DadosPlateia } from './levels/TiposFase';
import type { ConfigQualidade } from '../config/quality';
import { ligarSombra } from './Sombras';
import { criarSorteio } from './Ruido';
import type { Tracado } from './Tracado';

// =============================================================================
// PLATEIA: gente animada na largada e na chegada, atrás de barreiras.
// =============================================================================
// Quem pode aparecer: todo modelo com `plateia: true` no assets.ts. Para pôr
// uma pessoa nova na plateia, basta adicionar o modelo lá com essa marca.
//
// Cada pessoa tem um AnimationMixer, o "tocador" de animações do three.js.
// Escolhemos a animação pelo NOME (os modelos vêm com várias: andar, morrer,
// socar...). Quem não tiver nenhuma da lista fica parado, sem erro.
// =============================================================================

/** Animações de torcida, em ordem de preferência (parte do nome, sem maiúsculas). */
const ANIMACOES_TORCIDA = ['clap', 'cheer', 'wave', 'jump'];
/** Se não houver torcida, uma destas (gente parada de pé). */
const ANIMACOES_PARADO = ['idle', 'standing'];
/** Distâncias (m) da beira da pista: barreiras e a primeira fila de pessoas. */
const RECUO_BARREIRA = 2.5;
const RECUO_PESSOAS = 4.2;
/** Profundidade de cada fila de pessoas (m). */
const ENTRE_FILAS = 1.6;
/** Longe da câmera, ninguém percebe a animação: paramos de atualizar (economia). */
const DISTANCIA_ANIMAR = 140;
/**
 * Além disto (m), as pessoas nem são desenhadas: de longe são uns poucos
 * pixels, mas cada uma custa várias chamadas de desenho (uma por material,
 * mais a sombra). É o que mais pesava perto da largada.
 */
const DISTANCIA_VER = 220;

interface Torcedor {
  mixer: AnimationMixer;
  objeto: Object3D;
  posicao: Vector3;
}

export class Plateia {
  private readonly torcedores: Torcedor[] = [];

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly grupos: DadosPlateia[],
  ) {}

  async carregar(): Promise<void> {
    const modelos = (Object.keys(MODELOS) as IdModelo[]).filter((id) => (MODELOS[id] as InfoModelo).plateia === true);
    if (modelos.length === 0) return;
    const sorteio = criarSorteio(2027);
    await Promise.all(this.grupos.map((g) => this.montarGrupo(g, modelos, sorteio)));
  }

  /** Avança as animações de quem está perto da câmera. */
  atualizar(dt: number, posicaoCamera: Vector3): void {
    for (const t of this.torcedores) {
      const d2 = t.posicao.distanceToSquared(posicaoCamera);
      t.objeto.visible = d2 < DISTANCIA_VER * DISTANCIA_VER;
      if (d2 < DISTANCIA_ANIMAR * DISTANCIA_ANIMAR) t.mixer.update(dt);
    }
  }

  /** Na qualidade Baixa, as pessoas não projetam sombra. */
  aplicarQualidade(q: ConfigQualidade): void {
    for (const t of this.torcedores) ligarSombra(t.objeto, q.sombraCenario);
  }

  // ---------------------------------------------------------------------------

  private async montarGrupo(g: DadosPlateia, modelos: IdModelo[], sorteio: () => number): Promise<void> {
    const t = this.tracado;
    const sinal = g.lado === 'esquerda' ? 1 : -1;
    const borda = t.meiaLarguraTotal;

    await this.colocarBarreiras(g, sinal);

    for (let k = 0; k < g.quantidade; k++) {
      const id = modelos[Math.floor(sorteio() * modelos.length)];
      const [pessoa, animacoes] = await Promise.all([obterModelo(id), obterAnimacoes(id)]);
      const fila = k % 2;
      const distancia = g.distancia - g.comprimento / 2 + ((k + 0.5) / g.quantidade) * g.comprimento;
      const i = t.indiceEm(distancia);
      const afastamento = borda + RECUO_PESSOAS + fila * ENTRE_FILAS + sorteio() * 0.4;
      const p = t.pontoAoLado(distancia, g.lado, afastamento);
      p.y = t.alturaSuperficie(i, sinal * borda);
      pessoa.position.copy(p);
      // Olhando para a pista, com uma variação para não parecer um pelotão.
      const paraPista = t.esquerdas[i].clone().multiplyScalar(-sinal);
      pessoa.rotation.y = Math.atan2(paraPista.x, paraPista.z) + (sorteio() - 0.5) * 0.6;
      pessoa.scale.setScalar(0.92 + sorteio() * 0.16);
      this.cena.add(pessoa);

      const clipe = escolherAnimacao(animacoes, sorteio);
      if (!clipe) continue;
      const mixer = new AnimationMixer(pessoa);
      const acao = mixer.clipAction(clipe);
      // Cada um num ritmo e num momento diferente da animação.
      acao.timeScale = 0.85 + sorteio() * 0.3;
      acao.play();
      mixer.setTime(sorteio() * clipe.duration);
      this.torcedores.push({ mixer, posicao: p, objeto: pessoa });
    }
  }

  /** Barreiras de trânsito na frente da plateia (com colisor). */
  private async colocarBarreiras(g: DadosPlateia, sinal: number): Promise<void> {
    const t = this.tracado;
    const modelo = await obterModelo('barreiraTransito');
    const passo = 2.2;
    const matrizes: Matrix4[] = [];
    const lateral = sinal * (t.meiaLarguraTotal + RECUO_BARREIRA);
    for (let s = g.distancia - g.comprimento / 2; s <= g.distancia + g.comprimento / 2; s += passo) {
      const i = t.indiceEm(s);
      const p = t.pontoAoLado(s, g.lado, Math.abs(lateral));
      p.y = t.alturaSuperficie(i, sinal * t.meiaLarguraTotal);
      // Barreira de comprido ao longo da pista.
      const giro = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), t.anguloEm(i) + Math.PI / 2);
      matrizes.push(new Matrix4().compose(p, giro, new Vector3(1, 1, 1)));
      const colisorGiro = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), t.anguloEm(i));
      this.fisica.criarCaixaFixa({ x: p.x, y: p.y + 0.5, z: p.z }, 0.3, 0.5, passo / 2, colisorGiro);
    }
    criarInstancias(this.cena, modelo, matrizes);
  }
}

function escolherAnimacao(animacoes: AnimationClip[], sorteio: () => number): AnimationClip | undefined {
  const com = (nomes: string[]): AnimationClip[] =>
    animacoes.filter((a) => nomes.some((n) => a.name.toLowerCase().includes(n)));
  const torcida = com(ANIMACOES_TORCIDA);
  const opcoes = torcida.length > 0 ? torcida : com(ANIMACOES_PARADO);
  return opcoes[Math.floor(sorteio() * opcoes.length)];
}
