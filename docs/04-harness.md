# 4. O harness

Código em [`projetos/harness/`](../projetos/harness/). Nas execuções B ele é copiado por cima do
projeto base (`scripts/lib/montar-projeto.sh <destino> harness`).

## Os itens do enunciado → componentes

| Enunciado | Componente | Arquivo(s) |
|---|---|---|
| **Instruções para agentes** | regra de ouro, comandos, ambiente (ESM), arquitetura resumida, tabela de regras, testes, hooks | `AGENTS.md`, `CLAUDE.md` (importa o AGENTS.md) |
| **Regras arquiteturais** | arquitetura orientada a eventos (Sink → scan → log → projeções), camadas `dominio/aplicacao/http`, direção emissor → observador, 9 regras reativas com exemplos | `docs/arquitetura.md`, `docs/regras-reativas.md`, `.dependency-cruiser.cjs` |
| **Testes** | 11 testes de contrato da API + exigência de teste unitário para cada arquivo do domínio | `test/contrato/`, `scripts/verificar-estrutura.mjs` (regra E02) |
| **Lint** | lint genérico (oxlint) + **lint arquitetural** (verificador RX01–RX09 com a API do compilador TypeScript) + regras de camadas (dependency-cruiser) + estrutura de pastas | `.oxlintrc.json`, `scripts/verificar-reatividade.mjs`, `.dependency-cruiser.cjs`, `scripts/verificar-estrutura.mjs` |
| **Scripts de validação** | `npm run validate`: 7 etapas com resumo e saída enxuta para o agente | `scripts/validar.sh` |
| *(além do enunciado)* **Hooks** | verificação automática a cada edição e bloqueio do encerramento enquanto a validação falhar | `.claude/settings.json`, `scripts/hooks/` |

## As 7 etapas do `npm run validate`

| # | Etapa | Ferramenta | Pega... |
|---|---|---|---|
| 1 | tipos | `tsc --noEmit` | erros de compilação (ex.: imports ESM sem `.js`) |
| 2 | lint | oxlint | problemas genéricos de código |
| 3 | regras-reativas | `verificar-reatividade.mjs` | RX01–RX09 (paradigma) |
| 4 | dependencias | dependency-cruiser | camadas, ciclos, emissor importando observador |
| 5 | estrutura | `verificar-estrutura.mjs` | arquivos fora de `dominio/aplicacao/http`, domínio sem teste |
| 6 | testes-unitarios | Vitest | testes do domínio escritos pelo agente |
| 7 | testes-contrato | Vitest + servidor em porta livre | contrato HTTP essencial |

## As regras reativas (RX01–RX09)

| Regra | O que proíbe | Princípio |
|---|---|---|
| RX01 subscribe-aninhado | `subscribe` dentro de `subscribe`/operador | composição com operadores de achatamento |
| RX02 subscribe-fora-do-ciclo-de-vida | `subscribe` em controller ou método por requisição | assinaturas permanentes só no `onModuleInit` |
| RX03 subject-exposto | `Subject` público/exportado | só o dono do Sink emite |
| RX04 estado-mutavel | campos de classe/variáveis de módulo alterados por métodos | estado derivado do fluxo |
| RX05 temporizador-imperativo | `setTimeout`/`setInterval` | tempo como fluxo |
| RX06 eventos-fora-do-rxjs | `EventEmitter`, `@nestjs/event-emitter` | um único modelo de eventos (RxJS) |
| RX07 emissor-conhece-observador | leilões importando notificações | Observer: quem muda não conhece quem reage |
| RX08 acumulador-mutado | redutor do `scan` que altera o acumulador | redutores puros |
| RX09 dependencia-circular | ciclos de import | dependências em uma direção |

Detalhes, exemplos de errado/certo e limitações: [`projetos/harness/docs/regras-reativas.md`](../projetos/harness/docs/regras-reativas.md).

## O ciclo de feedback (como o harness atua durante a execução)

```mermaid
sequenceDiagram
  participant H as Humano
  participant A as Agente
  participant R as Repositório (harness)
  H->>A: tarefa (mesmo prompt de A)
  A->>R: lê AGENTS.md / CLAUDE.md / docs (instruções e regras)
  loop a cada edição de .ts em src/
    A->>R: Edit/Write
    R-->>A: hook PostToolUse: violações RX do arquivo (se houver)
  end
  A->>R: npm run validate (por conta própria, como pede a regra de ouro)
  R-->>A: ✔/✖ por etapa + saída dos erros
  A->>R: tenta encerrar
  R-->>A: hook Stop: roda validate; se falhar, bloqueia e devolve os erros (até 3×)
  A->>H: "terminei" (com a validação verde)
```

Sem o harness (condição A), o único feedback disponível é o que o próprio agente decidir verificar
— e, depois da entrega, o humano (aqui padronizado pelo prompt de intervenção do kit).

## Registro da atuação

Cada hook e cada `npm run validate` acrescenta uma linha em `.harness/hooks.log` (na pasta da
execução). Na finalização esse arquivo é copiado para `experimento/execucoes/B*/harness-hooks.log`
e resumido em `resumo.json` (edições verificadas, edições com violação, bloqueios do Stop, validações).

## O que o harness deliberadamente **não** contém

- A implementação da funcionalidade (nenhum arquivo do domínio de leilões é entregue pronto).
- Todos os testes: os 11 testes de contrato cobrem só o essencial; a suíte oculta tem 41
  (ver [6. Instrumento de avaliação](06-instrumento-de-avaliacao.md), tabela de sobreposição).

Ele **contém** padrões de código genéricos (`docs/arquitetura.md`) — conhecimento que um time real
colocaria no seu repositório. Essa escolha está registrada em [`decisoes.md`](decisoes.md) (ADR-011).

## Validação do harness

Antes do experimento, o gabarito foi montado com o harness e passou nas 7 etapas do
`npm run validate`; os hooks foram testados com entradas simuladas (edição com violação → saída 2;
Stop com falha → bloqueio 3× e liberação; novo prompt → contador zerado; Stop com validação ok →
liberado). Ver `docs/linha-do-tempo.md`.

Próximo: [5. Metodologia](05-metodologia.md).
