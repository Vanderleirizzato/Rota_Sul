# Rota Sul — prompts por etapa

## Como usar

1. Deixe o `CLAUDE.md` na raiz do projeto.
2. Rode **um prompt por vez** no Claude Code, na ordem.
3. Depois de cada etapa, jogue com `npm run dev`. Se algo estiver ruim, descreva o que sentiu ("o carro capota nas curvas", "a câmera treme") e peça o ajuste antes de seguir.
4. Quando a etapa estiver boa, faça um commit no git e use `/clear` antes do próximo prompt.

> **Antes de começar:** o projeto precisa ser um repositório git (`git init`). A Etapa 1A faz isso se ainda não existir.
>
> **Antes da Etapa 2:** a ponte está em `public/models/Bridge.fbx`. O ideal é abrir no Blender e exportar como `Bridge.glb` na mesma pasta. Se não for convertida, a Etapa 2 usa o `FBXLoader` só para ela.

---

## Etapa 1A — Carro e física

```
Leia o CLAUDE.md. Vamos fazer a Etapa 1A: carro e física.

1. Inicie o repositório git (se ainda não existir), crie o projeto com Vite + TypeScript e instale as dependências da stack. Crie um .gitignore com node_modules e dist.
2. Inspecione todos os .glb de public/models/ (escreva um script que liste, para cada um, as dimensões da bounding box e a quantidade de malhas e triângulos) e crie o manifesto src/world/assets.ts com tamanho-alvo e rotação de correção de cada modelo. Me mostre a tabela resultante e aponte os modelos com triângulos demais para serem repetidos muitas vezes.
3. Monte uma pista de teste simples: um plano grande de asfalto com uma reta longa, algumas curvas marcadas no chão e uma rampa. Iluminação básica (luz ambiente + sol com sombra). Sem cenário ainda.
4. Implemente o carro com Carro1.glb e Carro2.glb: veículo por raycast no Rapier com suspensão nas 4 rodas, aderência, drift no freio de mão e nitro. Todos os parâmetros em src/config/tuning.ts. A tecla 1 ou 2 troca o carro, só para teste.
5. Física em passo fixo de 1/60 s com acumulador e interpolação na renderização. Tecla R reposiciona o carro.
6. Câmera dinâmica com inércia, que se afasta e aumenta o campo de visão com a velocidade e no nitro. Tecla C troca a câmera.
7. Um texto simples na tela com velocidade em km/h (o HUD de verdade vem na 1B).
8. Tecla F2 abre o painel lil-gui que altera o tuning ao vivo.

O objetivo desta etapa é o carro ser gostoso de dirigir: estável em reta, derrapando de forma controlável, sem capotar à toa e sem atravessar o chão. Gaste o esforço aí. Use estabilizadores (centro de massa baixo, antirrolagem, direção que diminui com a velocidade), sempre com os valores no tuning.ts.
```

## Etapa 1B — Som, efeitos, HUD e visual

```
Leia o CLAUDE.md. Vamos fazer a Etapa 1B: som, efeitos, HUD e visual, em cima da física da 1A.

1. Partículas: fumaça nos pneus traseiros durante o drift e chamas no escapamento durante o nitro.
2. Som procedural com Web Audio: motor baseado em RPM, troca de marchas e derrapagem. O áudio só começa após a primeira tecla (regra dos navegadores).
3. HUD arcade: velocímetro digital em km/h, conta-giros, marcha e barra de nitro (substitui o texto simples da 1A).
4. Céu procedural (Sky shader), sol com sombras PCFSoftShadowMap acompanhando o carro, materiais PBR e clearcoat metálico na lataria dos dois carros.
5. Pós-processamento com EffectComposer, UnrealBloomPass e SMAAPass.
6. Seletor de qualidade (Baixo / Médio / Alto) em src/config/quality.ts, controlando sombras, bloom, SMAA, pixel ratio (máx. 2) e distância de desenho. Por enquanto, troque pelo painel F2.
7. Esc pausa o jogo (tela simples de pausa).

Não mexa na sensação de direção da 1A; se precisar mudar algo da física, me avise antes.
```

## Etapa 2 — Fase 1: Cataratas e Fronteira (Foz do Iguaçu)

```
Leia o CLAUDE.md. Vamos fazer a Etapa 2: a Fase 1, "Cataratas e Fronteira" (Foz do Iguaçu).

1. Crie o construtor de pistas: recebe o objeto de dados de uma fase e gera o asfalto sobre uma CatmullRomCurve3 (com faixas pintadas, acostamento e inclinação nas curvas), o terreno em volta, os colisores e as linhas de largada e chegada.
2. Crie src/world/levels/fase1-foz.ts só com dados, e substitua a pista de teste por ela (mantenha a pista de teste acessível para testes de física).
3. Traçado: estrada sinuosa de serra, com subidas e descidas, de 2 a 3 minutos de percurso.
4. Cenário: mata densa nas margens com Vine Covered Tree, Big Tree e Tree by Quaternius (com InstancedMesh e variação de escala e rotação). Se os modelos forem pesados demais, use os mais detalhados só perto da pista e versões mais leves/menos instâncias ao longe. Paredões rochosos nas curvas com Cliff by Poly, Rock Medium e Rock by Poly; uma travessia sobre um rio com a Bridge (Bridge.glb se existir; senão, Bridge.fbx com FBXLoader); e o Arch em um ponto marcante do trajeto.
5. Clima visual: luz de manhã, verde intenso, neblina leve ao longe e névoa de cachoeira perto da ponte.
6. Plateia na largada e na chegada com os modelos de pessoas (Man, Animated Woman, Adventurer), com animação se o modelo tiver.
7. Cronômetro da fase, contagem regressiva na largada e tela de Fim de Fase com o tempo.
8. Reposicionamento automático na pista se o carro cair ou sair muito do traçado.

Mantenha o carro e a física da Etapa 1 como estão. Ao final, me diga o fps na qualidade Baixa.
```

## Etapa 3 — Fase 2: Orla e Porto (Navegantes)

```
Leia o CLAUDE.md. Vamos fazer a Etapa 3: a Fase 2, "Orla e Porto" (Navegantes).

1. Crie src/world/levels/fase2-navegantes.ts só com dados, reaproveitando o construtor de pistas. Se o construtor precisar de algo novo, generalize-o em vez de criar um caso especial para esta fase.
2. Traçado: reta costeira rápida com curvas longas e abertas, terminando na área portuária, de 2 a 3 minutos de percurso.
3. Cenário: pôr do sol com mar brilhante de um lado (shader de água com reflexo do sol), coqueiros (Palm tree) e postes (Street Light e Lamp Post) com luz acesa ao longo da orla.
4. Porto: pátio com pilhas de contêineres (Shipping Container e Container Green) formando corredores, e navios no horizonte (Container Ship e Cruise ship).
5. Deixe atrás de uma fileira de contêineres um espaço vazio e acessível de carro por uma passagem estreita e discreta. Ele será usado na Etapa 5.
6. Seletor simples de fase para testar as duas.

Mantenha a Fase 1 funcionando.
```

## Etapa 4 — Tráfego e barreiras

```
Leia o CLAUDE.md. Vamos fazer a Etapa 4: tráfego e barreiras.

1. Tráfego: veículos (Truck, Bus, Taxi, Sushi Truck) circulando nas duas fases, seguindo a curva da pista na faixa correta e em velocidades variadas, com colisão física com o carro do jogador. A quantidade e os tipos vêm dos dados de cada fase.
2. Crie e destrua os veículos conforme a distância do jogador, para não pesar.
3. Barreiras: delimite as curvas perigosas com Traffic Barrier e Concrete Barrier (fixas), e use Plastic Barrier e Road Cone como objetos soltos que voam ao serem atingidos. As posições vêm dos dados de cada fase.
4. Som e um leve tremor de câmera nas batidas.

Confira que a física do carro continua estável ao bater em tráfego e em objetos soltos.
```

## Etapa 5 — Menus, easter eggs e polimento

```
Leia o CLAUDE.md. Vamos fazer a Etapa 5: menus, easter eggs e polimento.

Menus:
1. Menu inicial com o título "Rota Sul", garagem para escolher entre Carro1.glb e Carro2.glb (carro girando em um cenário iluminado), seletor de fase, seletor de qualidade e tela de créditos.
2. Pausa com Esc e fluxo completo: Menu -> Seleção de Carro -> Jogando -> Fim de Fase -> próxima fase ou Menu.
3. Guarde os melhores tempos de cada fase no localStorage.
4. Suporte a controle de videogame (Gamepad API): gatilhos aceleram/freiam, analógico esquerdo dá a direção, botões para freio de mão, nitro, reposicionar e câmera.

Easter eggs para o Enzo (estudante de ADS), com bom humor:
5. Um pórtico de entrada de cidade no meio do trajeto da Fase 1, com placa feita em CanvasTexture: "BEM-VINDO A ENZOLÂNDIA - Velocidade Máxima: Sem Limites".
6. Outdoors na beira da estrada, nas duas fases, com frases como "Cuidado: Bugs na pista à frente" e "Procura-se Dev de ADS para tunar este motor". Logo depois do outdoor dos bugs, alguns insetos gigantes (Praying Mantis, Scorpion, Spider) atravessam a pista.
7. Placa traseira dos dois carros com "ENZ-ADS", em CanvasTexture no padrão de placa brasileira (Mercosul).
8. Um segredo menor na Fase 1: a Stag Statue escondida num pequeno desvio fora da pista.
9. Na área secreta atrás dos contêineres do porto (Fase 2): um troféu brilhante flutuando e girando. Ao encostar nele, dispare fogos de artifício no céu, mostre a mensagem "Easter Egg Encontrado: Modo Dev Ativado!" e libere o Modo Dev: o painel lil-gui de tuning passa a abrir com F2 fora do desenvolvimento, já com um preset de super-velocidade. Guarde o desbloqueio no localStorage.

Polimento:
10. Revise o desempenho nas três qualidades e a tela de créditos com autor e licença de cada modelo.
11. Escreva um README.md curto em português: como rodar, controles, e onde ficam o tuning.ts e os arquivos de fase.
12. Escreva GUIA-NOVA-FASE.md: passo a passo para o Enzo criar uma fase copiando um arquivo de src/world/levels/, explicando cada campo. Termine com um desafio: "Crie a Fase 3: Serra da Graciosa — descida de serra com neblina".
```

## Etapa 6 — Publicar na Hostinger

```
Leia o CLAUDE.md. Vamos fazer a Etapa 6: preparar o jogo para publicação num subdomínio da Hostinger.

1. Ajuste vite.config.ts com base: './' (caminhos relativos), já que o jogo vai ficar na raiz de um subdomínio.
2. Se a pasta public/models/ passar de uns 50 MB no total, comprima os .glb com Draco ou Meshopt (ajustando o GLTFLoader para o decoder correspondente). Em qualquer caso, adicione uma barra de carregamento com o progresso real do download dos modelos, em vez de uma tela de loading sem informação.
3. Rode npm run build e depois npm run preview; confirme que o jogo abre e joga normalmente nessa prévia.
4. Gere um arquivo dist.zip com o conteúdo da pasta dist/ (os arquivos na raiz do zip, não a pasta dist dentro dele), para eu enviar pelo Gerenciador de Arquivos da Hostinger.
5. Me diga o tamanho final do zip e, se algum .glb continuar pesado, aponte qual.
```

Depois disso, na Hostinger:

1. hPanel → Domínios → Subdomínios → criar um subdomínio (ex.: `rotasul.seudominio.com.br`), apontando para uma pasta nova como `public_html/rotasul`.
2. Gerenciador de Arquivos → entrar nessa pasta → Fazer Upload → enviar o `dist.zip` → Extrair (e depois apagar o zip).
3. Acessar o endereço do subdomínio no navegador. Se a tela ficar em branco, abra o console do navegador (F12) e veja se algum arquivo deu erro 404 — geralmente é o `base` do `vite.config` que não foi aplicado antes do build.

Para atualizar o jogo depois de qualquer alteração, é repetir a Etapa 6 (gerar um zip novo) e os passos 2 e 3 acima, substituindo os arquivos antigos.

---

## Ideias para depois (desafios para o Enzo)

- Fase 3: Serra da Graciosa / BR-277, com neblina e chuva.
- Fantasma do melhor tempo (gravar a posição do carro a cada quadro e reproduzir).
- Controles por toque no celular.
