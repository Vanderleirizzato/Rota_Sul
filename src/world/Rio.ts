import {
  Box3,
  BoxGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type CanvasTexture,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { MundoFisico } from '../physics/MundoFisico';
import { CAMADA_EFEITOS } from '../graphics/Camadas';
import { SistemaParticulas, type ConfigParticulas } from '../graphics/Particulas';
import { texturaAgua, texturaCachoeira } from '../graphics/Texturas';
import { obterModelo } from './CarregadorModelos';
import { MODELOS } from './assets';
import type { DadosRio } from './levels/TiposFase';
import type { Tracado } from './Tracado';

// =============================================================================
// RIO, PONTE E CACHOEIRA
// =============================================================================
// O rio corre de lado em relação à pista (perpendicular a ela no ponto da
// ponte). O leito foi cavado pelo Terreno.ts; aqui entram:
//   - a água (um plano com textura que desliza = correnteza);
//   - a cachoeira rio acima: paredões de pedra com quedas d'água animadas;
//   - a névoa que sobe da cachoeira (partículas grandes e lentas);
//   - a ponte (só visual: quem segura o carro é o colisor da própria pista)
//     e o guarda-corpo, que tem colisor para ninguém cair no rio.
// =============================================================================

/** Altura do piso da ponte como fração da altura do modelo (medido no Bridge.fbx). */
const FRACAO_PISO_PONTE = 0.5;
/** Guarda-corpo: altura (m) e quanto passa da ponte em cada ponta. */
const GUARDA_CORPO = { altura: 1.0, sobra: 6 };
/** Quanto (m) a água entra em cada margem, além da largura do rio. */
const SOBRA_MARGEM = 5;
/** Comprimento da água rio abaixo (m). */
const RIO_ABAIXO = 600;
/** Velocidade aparente da correnteza e da queda d'água (repetições da textura por segundo). */
const VELOCIDADE_AGUA = 0.08;
const VELOCIDADE_QUEDA = 1.1;
/** Partículas de névoa por segundo. */
const NEVOA_POR_SEGUNDO = 26;

const NEVOA: ConfigParticulas = {
  maximo: 220,
  vida: 7,
  tamanhoInicial: 5,
  tamanhoFinal: 18,
  corInicial: new Color(0xffffff),
  corFinal: new Color(0xe4eef2),
  opacidade: 0.2,
  aditivo: false,
  empuxo: 0.35,
  arrasto: 0.25,
};

export class Rio {
  private readonly texturaAgua: CanvasTexture;
  private readonly texturaQueda: CanvasTexture;
  private readonly nevoa = new SistemaParticulas(NEVOA);
  /** Direção "rio acima" (horizontal), de lado em relação à pista. */
  private readonly rioAcima: Vector3;
  /** Direção ao longo da cachoeira (atravessando o rio). */
  private readonly atravessando: Vector3;
  private readonly baseCachoeira: Vector3;
  /** Onde o rio cruza a pista, na altura da água. */
  private readonly centro: Vector3;
  private acumuladoNevoa = 0;

  constructor(
    private readonly cena: Scene,
    private readonly fisica: MundoFisico,
    private readonly tracado: Tracado,
    private readonly rio: DadosRio,
  ) {
    const i = tracado.indiceEm(rio.distancia);
    const centro = tracado.pontos[i].clone().setY(rio.nivel);
    this.centro = centro;
    this.rioAcima = tracado.esquerdas[i].clone().multiplyScalar(rio.cachoeira.lado === 'esquerda' ? 1 : -1);
    this.atravessando = tracado.tangentes[i].clone().setY(0).normalize();
    this.baseCachoeira = centro.clone().addScaledVector(this.rioAcima, rio.cachoeira.distancia);

    this.texturaAgua = texturaAgua();
    this.texturaQueda = texturaCachoeira();
    this.criarAgua(centro);
    this.criarQuedas();
    this.nevoa.objeto.layers.set(CAMADA_EFEITOS);
    cena.add(this.nevoa.objeto);
    this.criarGuardaCorpo(i);
  }

  /**
   * O ponto (x, z) fica em cima da faixa de água do rio? Serve para o
   * "caiu na água". Não basta olhar se o chão está abaixo do nível da água:
   * o leito da estrada também é cavado, e em Foz o chão embaixo da largada
   * fica abaixo do nível do rio, longe de qualquer água.
   */
  cobre(x: number, z: number): boolean {
    const dx = x - this.centro.x;
    const dz = z - this.centro.z;
    const aoLongo = dx * this.rioAcima.x + dz * this.rioAcima.z;
    const atravessado = dx * this.atravessando.x + dz * this.atravessando.z;
    // A mesma faixa do plano de água (ver criarAgua), com a sobra das margens.
    return aoLongo > -RIO_ABAIXO && aoLongo < this.rio.cachoeira.distancia && Math.abs(atravessado) < this.rio.largura / 2 + SOBRA_MARGEM;
  }

  /** Parte que depende de arquivos (ponte e paredões). */
  async carregarModelos(): Promise<void> {
    await Promise.all([this.colocarPonte(), this.colocarParedoes()]);
  }

  atualizar(dt: number): void {
    this.texturaAgua.offset.y -= VELOCIDADE_AGUA * dt;
    this.texturaQueda.offset.y += VELOCIDADE_QUEDA * dt;

    this.acumuladoNevoa += NEVOA_POR_SEGUNDO * dt;
    const p = new Vector3();
    const v = new Vector3();
    const larguraQueda = this.rio.largura * 1.6;
    while (this.acumuladoNevoa >= 1) {
      this.acumuladoNevoa--;
      p.copy(this.baseCachoeira)
        .addScaledVector(this.atravessando, (Math.random() - 0.5) * larguraQueda)
        .addScaledVector(this.rioAcima, -2 - Math.random() * 6);
      p.y += Math.random() * 3;
      // A névoa se espalha rio abaixo, na direção da ponte.
      v.copy(this.rioAcima).multiplyScalar(-(1.5 + Math.random() * 3)).addScaledVector(this.atravessando, (Math.random() - 0.5) * 2);
      v.y = 0.4 + Math.random() * 0.8;
      this.nevoa.emitir(p, v);
    }
    this.nevoa.atualizar(dt);
  }

  ajustarEscala(camera: PerspectiveCamera, alturaEmPixels: number): void {
    this.nevoa.ajustarEscala(camera, alturaEmPixels);
  }

  // ---------------------------------------------------------------------------

  /** Gira um objeto para que o seu +Z aponte em `direcao` (horizontal). */
  private olharPara(direcao: Vector3): number {
    return Math.atan2(direcao.x, direcao.z);
  }

  private criarAgua(centro: Vector3): void {
    const comprimento = this.rio.cachoeira.distancia + RIO_ABAIXO;
    const largura = this.rio.largura + 2 * SOBRA_MARGEM; // a água entra um pouco nas margens
    this.texturaAgua.repeat.set(largura / 12, comprimento / 12);
    const agua = new Mesh(
      new PlaneGeometry(largura, comprimento),
      new MeshStandardMaterial({ color: 0x2e6b6e, map: this.texturaAgua, roughness: 0.12, metalness: 0.1 }),
    );
    // Plano deitado e com o comprimento ao longo do rio.
    agua.quaternion
      .setFromAxisAngle(new Vector3(0, 1, 0), this.olharPara(this.rioAcima))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
    agua.position.copy(centro).addScaledVector(this.rioAcima, (this.rio.cachoeira.distancia - RIO_ABAIXO) / 2);
    agua.receiveShadow = true;
    this.cena.add(agua);
  }

  /** Três quedas d'água lado a lado, como as Cataratas. */
  private criarQuedas(): void {
    const altura = this.rio.cachoeira.altura;
    const material = new MeshStandardMaterial({
      map: this.texturaQueda,
      color: 0xffffff,
      emissive: 0x334448, // um pouco de brilho próprio: água espumando nunca fica escura
      roughness: 0.4,
      transparent: true,
      opacity: 0.92,
      side: DoubleSide,
    });
    this.texturaQueda.repeat.set(2, altura / 10);
    const giro = this.olharPara(this.rioAcima.clone().negate());
    for (const [deslocamento, largura] of [[-16, 10], [0, 13], [15, 9]] as const) {
      const queda = new Mesh(new PlaneGeometry(largura, altura), material);
      queda.position
        .copy(this.baseCachoeira)
        .addScaledVector(this.atravessando, deslocamento)
        .addScaledVector(this.rioAcima, 1);
      queda.position.y += altura / 2 - 0.5;
      queda.rotation.y = giro;
      this.cena.add(queda);
    }
  }

  /** Paredões de pedra atrás das quedas. */
  private async colocarParedoes(): Promise<void> {
    const altura = this.rio.cachoeira.altura;
    const giro = this.olharPara(this.rioAcima.clone().negate());
    for (const deslocamento of [-24, 0, 24]) {
      const paredao = await obterModelo('paredao');
      const tamanho = new Box3().setFromObject(paredao).getSize(new Vector3());
      paredao.scale.setScalar((altura * 1.15) / tamanho.y);
      paredao.position
        .copy(this.baseCachoeira)
        .addScaledVector(this.atravessando, deslocamento)
        .addScaledVector(this.rioAcima, 9);
      paredao.position.y -= 3; // pé dentro da água
      paredao.rotation.y = giro;
      this.cena.add(paredao);
    }
  }

  private async colocarPonte(): Promise<void> {
    const ponte = await obterModelo('ponte');
    const i = this.tracado.indiceEm(this.rio.distancia);
    const alturaModelo = new Box3().setFromObject(ponte).getSize(new Vector3()).y;
    ponte.position.copy(this.tracado.pontos[i]);
    // O piso da ponte fica logo abaixo do asfalto da pista.
    ponte.position.y -= alturaModelo * FRACAO_PISO_PONTE + 0.05;
    ponte.rotation.y = this.tracado.anguloEm(i);
    this.cena.add(ponte);
  }

  /** Grades dos dois lados da ponte, com colisor (ninguém cai no rio). */
  private criarGuardaCorpo(iCentro: number): void {
    const t = this.tracado;
    const metade = Math.ceil((MODELOS.ponte.metros / 2 + GUARDA_CORPO.sobra) / t.espacamento);
    const inicio = Math.max(iCentro - metade, 0);
    const fim = Math.min(iCentro + metade, t.quantidade - 2);
    const quantidade = (fim - inicio) * 2;
    const grade = new InstancedMesh(
      new BoxGeometry(0.15, GUARDA_CORPO.altura, t.espacamento),
      new MeshStandardMaterial({ color: 0xc8cdd2, metalness: 0.6, roughness: 0.4 }),
      quantidade,
    );
    const giro = new Quaternion();
    const um = new Vector3(1, 1, 1);
    let n = 0;
    for (let i = inicio; i < fim; i++) {
      giro.setFromAxisAngle(new Vector3(0, 1, 0), t.anguloEm(i));
      for (const lado of [1, -1]) {
        const lateral = lado * (t.meiaLarguraTotal + 0.1);
        // Meio do trecho entre a amostra i e a i+1.
        const centro = t.pontos[i].clone().lerp(t.pontos[i + 1], 0.5).addScaledVector(t.esquerdas[i], lateral);
        centro.y = (t.alturaSuperficie(i, lateral) + t.alturaSuperficie(i + 1, lateral)) / 2 + GUARDA_CORPO.altura / 2;
        grade.setMatrixAt(n++, new Matrix4().compose(centro, giro, um));
        this.fisica.criarCaixaFixa(centro, 0.15, GUARDA_CORPO.altura / 2 + 0.5, t.espacamento / 2, giro);
      }
    }
    grade.castShadow = grade.receiveShadow = true;
    grade.computeBoundingSphere();
    this.cena.add(grade);
  }
}
