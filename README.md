# Rota Sul

Corrida arcade 3D no navegador, de **Foz do Iguaçu (PR)** a **Navegantes (SC)**.
Feito com Vite + TypeScript, three.js (gráficos), Rapier (física) e Web Audio (som sintetizado, sem arquivos de áudio).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
npm run build    # confere o TypeScript e gera a versão final em dist/
```

Atalhos de endereço (bons para testar):

- `localhost:5173/`: menu principal
- `?fase=fase1` ou `?fase=fase2`: vai direto para a fase (no jogo publicado, só se ela já foi liberada)
- `?fase=teste`: pista de teste de física

## Como se joga

No menu você escolhe o **personagem** (seis, cada um com seu nome) e, nesta fase de testes, a **cidade** (as duas estão liberadas; para voltar à progressão normal, mude `TODAS_LIBERADAS_PARA_TESTE` para `false` em `src/core/Progresso.ts`). A viagem começa sempre em **Foz do Iguaçu**, **a pé**: os seus três carros estão estacionados em ruas diferentes do bairro ao lado da largada. Ande até o que quiser e aperte **E** para entrar. Dá para pegar também os carros do trânsito e os estacionados nos bairros (táxi, esportivo, viatura e caminhão). Depois é o **modo passeio**: o mapa é livre, sem cronômetro. A bússola no alto da tela aponta a **coluna de luz amarela** da largada; pare dentro do anel dela e aperte **Enter** para a corrida começar. Durante a corrida valem o cronômetro e a volta automática para a pista.

- **Tempo-meta:** terminar a corrida abaixo dele libera a próxima cidade. Aí aparece uma **coluna azul** logo depois da chegada: pare nela e aperte Enter para seguir viagem (ou **N** na tela de chegada).
- **Peças de tuning:** engrenagens brilhantes espalhadas pelo mapa (algumas no caminho da corrida, outras escondidas). Cada uma deixa o carro um pouco melhor, para sempre: 🟠 turbo (motor), 🔵 pneus (aderência), 🟣 nitro (dura mais).
- O progresso (cidades liberadas, peças e recordes) fica salvo no navegador.

## Controles

| Ação | Teclado | Controle |
|---|---|---|
| Acelerar | W / ↑ | RT |
| Frear e ré | S / ↓ | LT |
| Direção | A D / ← → | analógico esquerdo |
| Freio de mão (drift) | Espaço | B |
| Nitro | Shift | A |
| Reposicionar na pista | R | X |
| Começar a corrida (no marcador) | Enter | A |
| (Re)começar a corrida da largada | T | Back |
| Abandonar a corrida (na pausa) | Q | X |
| Seguir para a próxima fase (na chegada) | N | Y |
| Trocar câmera | C | Y |
| Pausar | Esc | Start |
| Voltar ao menu (na pausa ou no fim) | M | B |
| Descer do carro / entrar num carro (no passeio) | E | LB |
| Painel de tuning (Modo Dev) | F2 | |

**A pé** (depois do E): W/S anda, A/D vira, Shift corre, Espaço pula e R volta para o lado do carro. Dá para pegar peças a pé, mas corrida e viagem são de carro.

No jogo publicado, o F2 só funciona depois de achar o segredo do porto. 🏆

## Onde mexer

- **`src/config/tuning.ts`**: todos os números do carro (potência, aderência, suspensão, nitro, velocidade máxima, gravidade...). Cada valor diz o que acontece ao aumentar ou diminuir. Com o jogo rodando, o F2 mexe nesses mesmos valores ao vivo.
- **`src/config/quality.ts`**: o que muda entre as qualidades Baixa, Média e Alta.
- **`src/world/levels/`**: as fases. Cada fase é um arquivo só de dados (traçado, bioma, objetos, trânsito, outdoors...). Para criar uma, veja o **[GUIA-NOVA-FASE.md](GUIA-NOVA-FASE.md)**.
- **`src/world/assets.ts`**: a lista dos modelos 3D, com o tamanho de cada um no jogo.
- **`CREDITOS.md`**: os autores dos modelos 3D. A tela de créditos do jogo lê este arquivo.

## Organização do código

| Pasta | O que tem |
|---|---|
| `src/config/` | tuning e qualidade gráfica |
| `src/core/` | laço principal, estados (menu/corrida), teclado e controle, som, recordes |
| `src/physics/` | mundo do Rapier e o carro (veículo por raycast) |
| `src/graphics/` | luz, céu, câmera, partículas, pós-processamento, vitrine de personagens do menu |
| `src/world/` | construtor de pista, terreno, biomas, trânsito, objetos e fases |
| `src/ui/` | HUD, menus, pausa, painel do Modo Dev |
