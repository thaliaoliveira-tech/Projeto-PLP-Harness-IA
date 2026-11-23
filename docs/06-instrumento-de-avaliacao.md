# 6. Instrumento de avaliação (kit oculto)

Pasta [`avaliacao/`](../avaliacao/). Os agentes nunca têm acesso a ela: as execuções rodam em pastas
fora do repositório principal.

## Componentes

| Componente | Arquivo | Mede |
|---|---|---|
| Suíte de aceitação | `aceitacao/*.test.ts` (41 testes) | **erros** funcionais, caixa-preta via HTTP contra `npm run start:prod` |
| Verificador de regras | `projetos/harness/scripts/verificar-reatividade.mjs` (cópia do repositório principal) | **violações arquiteturais** RX01–RX09 |
| Avaliador | `avaliar.mjs` | orquestra tudo e gera `metricas.json`, `avaliacao.md` e o prompt de intervenção |
| Gabarito | `referencia/src/` | implementação reativa correta (valida o instrumento) |
| Anti-gabarito | `anti-gabarito/src/` | implementação imperativa correta (valida o instrumento) |
| Testes do verificador | `verificador/` (10 casos) | o próprio verificador |

## O que o avaliador faz em cada checkpoint

1. Instala dependências se faltarem (o agente pode ter adicionado pacotes).
2. `tsc --noEmit` → erros de tipo (inclui os testes escritos pelo agente).
3. `npm run build` → build ok/falhou.
4. oxlint com a **configuração fixa da base** → erros/avisos de lint genérico (igual para A e B, mesmo que o agente mude a configuração do projeto).
5. Verificador RX01–RX09 (versão do repositório principal, imune a alterações do agente).
6. Sobe o servidor com `npm run start:prod` numa porta livre e roda a suíte de aceitação **2 vezes**;
   um teste falha se falhar em qualquer repetição e é marcado *instável* se oscilar.
7. Métricas de código (linhas, testes escritos pelo agente, `subscribe`, imports do RxJS, dependências adicionadas).
8. Integridade do harness (B): quais arquivos do harness o agente alterou ou apagou.
9. Gera o **prompt de intervenção padronizado** (build, testes falhando com a mensagem de erro,
   violações agrupadas por regra com "como corrigir"). É o único feedback que o humano envia ao agente.

Critério de **aprovado**: build ok, 41/41 testes e 0 violações.

## A suíte de aceitação (41 testes)

| Arquivo | Testes | Cobre |
|---|---|---|
| `01-criacao` | 12 | formato do recurso, padrão de `prorrogacaoSegundos`, ids únicos, 6 validações 400, GET 200/404, ordem da listagem |
| `02-lances` | 10 | lance inicial, mínimo com incremento, limite exato, participante que já lidera, 404 antes do 400, 3 validações 400, recusas não alteram estado |
| `03-eventos` | 3 | sequência e dados de cada evento, 400/404 não geram eventos, 404 do histórico |
| `04-tempo` | 7 | encerramento automático, sem lances, 409 após encerrar, prorrogação, fora da janela, prorrogação 0, várias prorrogações |
| `05-notificacoes` | 3 | `LANCE_SUPERADO` em ordem, `LEILAO_VENCIDO`, lista vazia |
| `06-stream` | 4 | `text/event-stream` + histórico, tempo real, fecha após o encerramento, leilão já encerrado |
| `07-concorrencia` | 2 | 20 lances simultâneos sem perder/duplicar eventos, leilões independentes |

### Sobreposição com os testes de contrato do harness

Os testes do harness (11) foram escritos à parte e cobrem só o essencial. Para cada teste oculto:
**✓** há um teste do harness equivalente; **◐** o harness cobre parcialmente; **✗** não há.

| Teste oculto | Harness |
|---|---|
| cria leilão 201 com todos os campos | ✓ |
| `prorrogacaoSegundos` padrão 0 | ✗ |
| ids únicos | ✗ |
| 400: título vazio | ◐ (um único caso combinado) |
| 400: `lanceInicial` 0 / `incrementoMinimo` negativo / duração 0 / duração não inteira / prorrogação negativa (5) | ✗ |
| GET `/leiloes/:id` devolve o leilão | ◐ (usado indiretamente) |
| GET inexistente 404 | ✓ |
| listagem na ordem de criação | ✗ |
| primeiro lance = lance inicial aceito | ✓ |
| primeiro lance abaixo do inicial (422 + `valorMinimo`) | ◐ |
| abaixo de maior + incremento (422 + `valorMinimo`) | ✓ |
| exatamente o mínimo é aceito | ✗ |
| participante que já lidera (422) | ✓ |
| leilão inexistente: 404 antes do 400 | ✗ |
| 400 do lance (3 casos) | ✗ |
| recusas não alteram o estado | ✗ |
| eventos: ordem, sequência e **dados** | ◐ (só tipos e sequência) |
| 400/404 não geram eventos | ✗ |
| histórico inexistente 404 | ✗ |
| encerramento automático com vencedor | ✓ |
| sem lances: vencedor `null` | ✗ |
| lance após encerramento 409 **e sem evento** | ◐ (só o 409) |
| prorrogação anti-sniping (4 testes) | ✗ |
| `LANCE_SUPERADO` em ordem cronológica | ◐ (um caso) |
| `LEILAO_VENCIDO` | ✗ |
| notificações vazias | ✗ |
| SSE: content-type + histórico | ◐ |
| SSE: tempo real | ✗ |
| SSE: fecha após encerramento | ✓ |
| SSE: leilão já encerrado | ✗ |
| concorrência (2 testes) | ✗ |

**Resumo: 7 ✓, 7 ◐, 27 ✗.** Dois terços da suíte oculta testam requisitos que o harness não
verifica: medem se o agente implementou a especificação, não se decorou os testes do harness.

## O verificador de regras (análise estática)

Usa a API do compilador TypeScript para percorrer a árvore sintática de cada arquivo de `src/`
(exceto testes). Não depende da estrutura de pastas — vale igualmente para A, que não conhece a
arquitetura do harness. Regras e limitações em `projetos/harness/docs/regras-reativas.md`.

## Validação do instrumento (feita antes das execuções)

| Verificação | Resultado |
|---|---|
| Gabarito (reativo) na suíte de aceitação | **41/41** |
| Gabarito no verificador | **0 violações** |
| Gabarito + harness no `npm run validate` | **7/7 etapas** |
| Anti-gabarito (imperativo) na suíte de aceitação | **41/41** → os testes não penalizam o estilo |
| Anti-gabarito no verificador | **12 violações** (RX02, RX03, RX04×5, RX05×3, RX07×2) → o verificador discrimina o paradigma |
| Casos de teste do verificador (`npm run test:verificador`) | **10/10** |
| Estresse: 10 rodadas seguidas da suíte contra o mesmo servidor (gabarito corrigido) | **410/410** execuções verdes |
| Projeto com erro de compilação | build falhou, 0/41, prompt com o erro do compilador |

### O bug que o instrumento encontrou no próprio gabarito

A primeira bateria de estresse mostrou falhas intermitentes nos testes de tempo. A causa: em ~8% dos
casos (24 de 300 medidos) o temporizador do Node dispara **1 ms antes** de `Date.now()` alcançar o
prazo. O gabarito decidia o encerramento comparando o relógio (`agora >= encerraEm`), concluía
"ainda não venceu" e — como nenhum novo temporizador era agendado — o leilão nunca encerrava.
Correção: o comando de encerramento carrega o prazo para o qual foi agendado (ADR-008). Lições:

1. É um erro realista de sistemas reativos com tempo — implementações dos agentes podem tê-lo.
2. Por isso a suíte roda 2× por checkpoint e reporta testes instáveis (ADR-009).
3. A armadilha foi documentada no harness (`docs/arquitetura.md`, padrão 3), como faria um time real.

## Como reproduzir a validação

```bash
# gabarito com harness: validate + avaliação completa
scripts/lib/montar-projeto.sh /tmp/ref harness --overlay avaliacao/referencia
(cd /tmp/ref && npm run validate)
node avaliacao/avaliar.mjs --projeto /tmp/ref --saida /tmp/aval-ref

# anti-gabarito sem harness
scripts/lib/montar-projeto.sh /tmp/anti base --overlay avaliacao/anti-gabarito
node avaliacao/avaliar.mjs --projeto /tmp/anti --saida /tmp/aval-anti

# testes do verificador
(cd avaliacao && npm run test:verificador)
```
