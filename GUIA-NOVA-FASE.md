# Guia: como criar uma fase nova

Uma fase do Rota Sul é **só dados**: um arquivo TypeScript que exporta um objeto dizendo por onde a estrada passa, que bioma tem em volta, onde ficam os objetos, como é a luz e quanto trânsito tem. Quem transforma esses dados em mundo 3D é o `src/world/Fase.ts`, e você não precisa mexer nele.

O "formato" de uma fase (cada campo, com comentário) está em `src/world/levels/TiposFase.ts`. Se faltar um campo obrigatório ou você digitar um nome errado, o TypeScript avisa antes de rodar.

## Passo a passo

### 1. Copie uma fase existente

```bash
cp src/world/levels/fase1-foz.ts src/world/levels/fase3-serra.ts
```

No arquivo novo, troque o nome da constante (`FASE1_FOZ` → `FASE3_SERRA`), o `id`, o `nome` e o `local`:

```ts
export const FASE3_SERRA: DadosFase = {
  id: 'fase3-serra',          // usado para guardar o recorde: precisa ser único
  nome: 'Serra da Graciosa',  // aparece no menu e na largada
  local: 'Morretes · PR',
  ...
```

### 2. Registre a fase

Em `src/world/levels/index.ts`, importe e acrescente na lista (a ordem da lista é a ordem da viagem: o "Enter → próxima fase" segue ela):

```ts
import { FASE3_SERRA } from './fase3-serra';

export const FASES = {
  fase1: FASE1_FOZ,
  fase2: FASE2_NAVEGANTES,
  fase3: FASE3_SERRA,
} satisfies Record<string, DadosFase>;
```

Pronto: ela já aparece na viagem do menu, e `localhost:5173/?fase=fase3` vai direto para ela (no `npm run dev`, mesmo trancada).

**Pode inserir no meio!** Quer Cascavel entre Foz e Navegantes? Ponha `cascavel` entre `fase1` e `fase2` na lista. O progresso é salvo pelo `id` de cada fase, então quem já tinha liberado Navegantes continua com ela liberada. Só lembre de dar um `tempoParaLiberar` para a fase de antes (é ele que libera a seguinte).

### 3. Desenhe a estrada (`tracado`)

Uma lista de pontos `[x, altura, z]` em metros. O jogo liga os pontos com uma curva suave (`CatmullRomCurve3`).

- Deixe **80 a 120 m** entre os pontos. Pontos muito perto, com mudança brusca de direção, viram curvas fechadas demais.
- Subidas acima de **~8 %** (8 m de altura a cada 100 m) ficam difíceis para o carro.
- Comente a distância de cada ponto (`// 1352 · alto do morro`): ajuda a posicionar o resto.

Tudo que fica **ao longo da pista** usa `distancia`, em metros desde o primeiro ponto. Se você mexer no traçado, os objetos continuam no mesmo trecho da estrada.

### 4. Preencha os campos

| Campo | Para que serve |
|---|---|
| `pista` | largura do asfalto, acostamento e inclinação nas curvas |
| `largada`, `chegada` | distâncias (m) das duas linhas |
| `bioma` | a "cara" do mundo em volta: `'mataAtlantica'` ou `'litoral'` (veja `src/world/biomas.ts`; dá para criar um novo lá) |
| `iluminacao` | direção e cor do sol, cor do céu e da neblina. `direcaoSol` com Y pequeno = sol baixo (amanhecer, pôr do sol) |
| `objetos` | objetos soltos: pedras, paredões, o arco... (`modelo` é um nome do `src/world/assets.ts`) |
| `fileiras` | muitos objetos iguais em fila: postes, coqueiros, prédios, contêineres |
| `rio` / `mar` | rio com ponte e cachoeira; ou mar de um lado, com praia |
| `patios` | área calçada fora da pista onde o carro anda livre (porto, desvio secreto) |
| `plateia` | gente torcendo atrás das barreiras |
| `andarilhos` | mochileiros no acostamento |
| `trafego` | quantos veículos, de que tipos e em que velocidade |
| `barreiras` | muros fixos na beira das curvas perigosas |
| `soltos` | cones e barreiras de plástico que voam na batida |
| `outdoors`, `portico`, `insetos`, `trofeu` | os easter eggs (todos opcionais) |
| `estacionamento` | onde os 3 carros do jogador começam parados (antes de `trafego.inicio`) |
| `tempoParaLiberar` | tempo-meta (s): terminar a corrida abaixo dele libera a próxima fase da lista |
| `pecas` | peças de tuning (`'turbo'`, `'pneus'` ou `'nitro'`) espalhadas pelo mapa |

Campos com `?` no `TiposFase.ts` são opcionais: se não quiser rio, é só não escrever `rio`.

### 5. Teste

```bash
npm run dev
```

Abra `localhost:5173/?fase=fase3`. Dicas:

- **F2** abre o painel: em "Mostrar colisores" você vê o que a física enxerga (bom para achar obstáculo invisível).
- **R** reposiciona o carro: útil para explorar a pista.
- Rode `npm run build` no fim: ele confere todo o TypeScript.

## Dicas

- **Nada de número mágico**: comportamento do carro fica em `src/config/tuning.ts`, não na fase.
- **Modelo novo?** Coloque o `.glb` em `public/models/`, crie uma entrada em `src/world/assets.ts` (com o tamanho em metros) e acrescente o autor no `CREDITOS.md`.
- **Desempenho**: muitas árvores "pesadas" ou trânsito demais pesam no notebook. Teste na qualidade Baixa.

---

## 🏁 Desafio

**Crie a Fase 3: Serra da Graciosa, uma descida de serra com neblina.**

Algumas ideias para começar:

1. Um traçado que **desce** bastante (comece lá em cima, com altura 80, e termine perto de 0), cheio de curvas em "S". Lembre do limite de ~8 % de inclinação.
2. Bioma `'mataAtlantica'`, mas com **neblina** forte: em `iluminacao`, use `inicioNeblina` bem baixo (0,05), `corNeblina` acinzentada e um sol fraco (`intensidadeSol` perto de 2).
3. **Barreiras** de concreto do lado de fora de todas as curvas fechadas (a serra é perigosa!) e paredões de pedra do lado de dentro.
4. Pouco trânsito, mas com caminhões **lentos** (40 a 55 km/h) para ultrapassar nas retas.
5. Bônus: um segredo seu, escondido num `patios` fora da pista. 😉
