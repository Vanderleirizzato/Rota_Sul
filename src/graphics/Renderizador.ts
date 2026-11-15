import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

/** Limite do devicePixelRatio: telas 3x custariam 9 vezes mais pixels que 1x. */
const PIXEL_RATIO_MAXIMO = 2;

export function criarRenderizador(): WebGLRenderer {
  const r = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_MAXIMO));
  r.setSize(window.innerWidth, window.innerHeight);
  r.shadowMap.enabled = true;
  // Sombra suave (PCF). Até o three r17x existia o PCFSoftShadowMap; nas versões
  // novas ele foi removido porque o PCFShadowMap comum já filtra suave.
  r.shadowMap.type = PCFShadowMap;
  r.outputColorSpace = SRGBColorSpace;
  // Tone mapping "cinematográfico": evita que o sol estoure em branco chapado.
  r.toneMapping = ACESFilmicToneMapping;
  document.body.appendChild(r.domElement);
  return r;
}
