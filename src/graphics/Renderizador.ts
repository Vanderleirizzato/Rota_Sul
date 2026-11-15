import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

/** Exposição geral da imagem (como a de uma câmera). Mais alto: tudo mais claro. */
const EXPOSICAO = 0.5;

export function criarRenderizador(): WebGLRenderer {
  // antialias: false porque a suavização das bordas é feita pelo SMAA no
  // pós-processamento (o antialias do navegador não age nas imagens intermediárias).
  const r = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  r.shadowMap.enabled = true;
  // Sombra suave (PCF). Até o three r17x existia o PCFSoftShadowMap; nas versões
  // novas ele foi removido porque o PCFShadowMap comum já filtra suave.
  r.shadowMap.type = PCFShadowMap;
  r.outputColorSpace = SRGBColorSpace;
  // Tone mapping "cinematográfico": o céu e o sol têm brilho muito acima do que
  // a tela mostra; o ACES comprime isso sem estourar tudo em branco chapado.
  r.toneMapping = ACESFilmicToneMapping;
  r.toneMappingExposure = EXPOSICAO;
  document.body.appendChild(r.domElement);
  return r;
}
