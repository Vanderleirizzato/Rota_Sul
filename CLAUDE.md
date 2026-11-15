# Projeto: Rota Sul (Foz do Iguaçu -> Navegantes)

## Visão Geral
Jogo de corrida arcade 3D no navegador, em fases, ligando Foz do Iguaçu (PR) a Navegantes (SC).

O jogo é um presente para o Enzo, estudante do 2º ano de ADS. Além de divertido, o código precisa ser **legível e fácil de modificar por ele**. Isso vale tanto quanto o jogo funcionar.

## Como trabalhar neste projeto
- O desenvolvimento é feito **em etapas**. Implemente somente a etapa pedida no prompt; não adiante etapas futuras.
- Ao final de cada etapa: rode `npm run build` e corrija todos os erros de TypeScript, depois diga em poucas linhas o que testar com `npm run dev` e quais teclas usar.
- Não quebre o que já funcionava nas etapas anteriores.
- Se um modelo `.glb` esperado não existir ou vier com problema, avise e use uma forma simples no lugar; não invente arquivos.

## Stack Obrigatória
- Vite + TypeScript (modo `strict`, sem `any`).
- Three.js: sombras dinâmicas (PCFSoftShadowMap), materiais PBR, céu procedural (Sky shader) e pós-processamento (EffectComposer com UnrealBloomPass e SMAAPass).
- `@dimforge/rapier3d-compat` para a física. O carro usa veículo por raycast (`DynamicRayCastVehicleController`) com suspensão nas 4 rodas, aderência e drift.
- Web Audio API para som procedural: motor baseado em RPM, troca de marchas e derrapagem. Sem arquivos de áudio.
- `lil-gui` para o painel do Modo Dev.

## Código pensado para o Enzo
- Comentários em **português**, explicando o **porquê** das decisões (ex.: por que a suspensão usa raycast, por que a física roda em passo fixo), não o óbvio.
- Nomes de arquivos, classes e variáveis claros. Arquivos pequenos, uma responsabilidade cada.
- **`src/config/tuning.ts`**: todos os números que mudam o comportamento do carro (potência, aderência, rigidez da suspensão, força do nitro, velocidade máxima, gravidade), cada um com comentário dizendo o que acontece ao aumentar ou diminuir. Nenhum "número mágico" de jogabilidade espalhado pelo código.
- **Fases como dados**: cada fase é um arquivo em `src/world/levels/` que exporta um objeto simples (pontos da curva, bioma, lista de objetos, iluminação, tráfego). O construtor de pista lê esse objeto. Criar uma fase nova deve ser copiar um arquivo e editar os dados.
- **Modo Dev**: painel `lil-gui` que altera os valores de `tuning.ts` ao vivo. Fica escondido até ser liberado pelo easter egg do troféu (etapa 5); durante o desenvolvimento, a tecla `F2` abre o painel.

## Estrutura do mundo
- **Fases lineares**, não mundo aberto. Cada fase é uma pista sobre `CatmullRomCurve3`, com início e chegada.
- Pequenos desvios e áreas escondidas fora da pista são permitidos para os segredos.
- O jogador não pode cair para fora do mundo: use barreiras, relevo ou reposicionamento automático na pista.

## Assets 3D (`public/models/`)
Todos os modelos estão em `public/models/` no formato `.glb`. Os nomes reais dos arquivos podem diferir dos nomes citados nos prompts; inspecione a pasta e faça a correspondência.
- **Manifesto único** em `src/world/assets.ts`: para cada modelo, o arquivo, o tamanho-alvo em metros (ex.: carro com ~4,5 m de comprimento, ônibus ~12 m, cone ~0,7 m de altura) e a rotação de correção.
- Ao carregar com `GLTFLoader`: escalar pelo tamanho-alvo do manifesto, centralizar em X/Z e apoiar a base da bounding box em Y = 0, para nada ficar gigante, minúsculo ou flutuando.
- Carregar cada arquivo uma única vez (cache) e clonar. Para objetos muito repetidos (árvores, cones, pedras), usar `InstancedMesh`.
- `castShadow = true` e `receiveShadow = true` em todas as malhas.
- Lataria de `Carro1.glb` e `Carro2.glb` com reflexo metálico e clearcoat (`MeshPhysicalMaterial`).
- Colisores físicos simples (caixas/cilindros) para os objetos sólidos; vegetação pequena sem colisor.

## Desempenho
- Seletor de qualidade (Baixo / Médio / Alto) em `src/config/quality.ts`, controlando sombras, bloom, SMAA, pixel ratio e distância de desenho. Padrão: Médio.
- Limitar `devicePixelRatio` a no máximo 2.
- Sombra direcional acompanhando o carro, cobrindo só a área próxima.
- Meta: 60 fps em notebook com vídeo integrado na qualidade Baixa.

## Física e loop
- Física em passo fixo de 1/60 s com acumulador; a renderização interpola entre os passos.
- Unidades SI (metros, quilogramas, segundos). Velocímetro em km/h.

## Controles
- `W`/`↑` acelerar, `S`/`↓` frear e ré, `A`/`D` ou `←`/`→` direção.
- `Espaço` freio de mão (drift), `Shift` nitro.
- `R` reposicionar o carro na pista, `T` reiniciar a corrida da largada, `C` trocar câmera, `Esc` pausar.

## Arquitetura Modular
- `/src/config/`: `tuning.ts` e `quality.ts`.
- `/src/core/`: loop principal, gerenciador de estados (Menu, Seleção de Carro, Jogando, Pausa, Fim de Fase), entrada do teclado e áudio sintetizado.
- `/src/physics/`: mundo Rapier e física do veículo.
- `/src/graphics/`: iluminação, pós-processamento, partículas (fumaça de drift, fogo do nitro) e câmera dinâmica com inércia.
- `/src/world/`: `assets.ts`, construtor de pistas, biomas e tráfego. Fases em `/src/world/levels/`.
- `/src/ui/`: HUD arcade (velocímetro digital, conta-giros, barra de nitro, cronômetro), menus, seletor de carros e fases, painel do Modo Dev.

## Créditos
Manter `CREDITOS.md` e uma tela de créditos no menu com o autor e a licença de cada modelo 3D. Onde o autor não for identificável pelo arquivo, deixar marcado como "a preencher".
