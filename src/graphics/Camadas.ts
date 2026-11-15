// Camadas (layers) do three.js: cada objeto pode estar em uma ou mais das 32
// camadas, e a câmera só desenha as camadas que estiverem ligadas nela.
// Usamos isso no bloom seletivo (ver PosProcessamento.ts).

/** Objetos comuns. Todo objeto nasce nesta camada. */
export const CAMADA_NORMAL = 0;
/** Objetos que BRILHAM no bloom: chamas do nitro, faróis, postes acesos, fogos. */
export const CAMADA_BRILHO = 1;
/** Efeitos transparentes que não brilham nem tampam o brilho (fumaça). */
export const CAMADA_EFEITOS = 2;
