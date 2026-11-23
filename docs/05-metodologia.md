# 5. Metodologia

## Desenho

Experimento com **uma variável independente** (presença do harness) em **duas condições**, com
**3 repetições** cada:

| Condição | Projeto entregue ao agente | Execuções |
|---|---|---|
| A — sem harness | `projetos/base` | A1, A2, A3 |
| B — com harness | `projetos/base` + `projetos/harness` | B1, B2, B3 |

Ordem contrabalançada **A1 → B1 → B2 → A2 → A3 → B3**, para que efeitos de ordem (aprendizado do
condutor, variações do serviço do modelo ao longo do tempo) não favoreçam uma condição.

## Controles (o que é igual entre A e B)

- **Mesma tarefa**, palavra por palavra (`experimento/prompts/tarefa.md`), incluindo o pedido de
  usar programação reativa com RxJS.
- **Mesma base**: NestJS 12 limpo, sem os arquivos de agente que o gerador oficial cria (ADR-004).
- **Mesmo agente e configuração**: Claude Code, mesmo modelo, esforço e modo de permissão; conversa
  nova a cada execução; sem instruções globais.
- **Isolamento**: cada execução numa pasta nova fora do repositório principal (o agente não vê o
  kit, o gabarito nem outras execuções) e com histórico git próprio (ADR-005).
- **Mesmas intervenções**: o humano só envia o prompt inicial, os prompts de intervenção **gerados
  pelo kit** e duas respostas padronizadas (ver protocolo).
- **Mesmo avaliador** em todos os checkpoints (`avaliacao/avaliar.mjs`).
- **Mesmos critérios de parada**: aprovado, 8 rodadas de correção ou 120 minutos.

## Variáveis dependentes (definições operacionais)

| Métrica | Definição | Fonte |
|---|---|---|
| **Erros** | build quebrado (0/1) + testes de aceitação ocultos falhando (de 41), na 1ª entrega e no final. Um teste que falha em qualquer das 2 repetições conta como falha. Complementares: erros de tipo (`tsc`) e de lint genérico | `checkpoints/*/metricas.json` |
| **Violações arquiteturais** | ocorrências das regras RX01–RX09 detectadas pelo verificador estático (o mesmo para A e B), na 1ª entrega e no final | idem |
| **Intervenções humanas** | prompts de correção (rodadas) + edições manuais de código + outras mensagens humanas após o prompt inicial (respostas padronizadas a perguntas, "continue") | `execucao.json` + transcrição da sessão |
| Tempo | minutos entre a primeira mensagem humana e o último checkpoint | transcrição + `execucao.json` |
| Esforço do agente | chamadas de ferramenta, erros de ferramenta, tokens | transcrição (`resumo-sessao.json`) |
| Produto | linhas de código, casos de teste escritos pelo agente, dependências adicionadas | `metricas.json` |
| Atuação do harness (B) | edições verificadas/com violação, bloqueios do Stop, validações | `harness-hooks.log` |

**Primeira entrega** = estado do código quando o agente diz que terminou o prompt inicial, antes de
qualquer intervenção. É a medida mais limpa do efeito do harness (H1, H2). O **número de
intervenções** mede o custo humano para chegar a uma solução correta e conforme (H3).

## Procedimento

Descrito passo a passo em [`experimento/protocolo.md`](../experimento/protocolo.md):
preparar → prompt inicial → checkpoint da entrega → (intervenção → checkpoint de correção)* →
finalizar. Cada checkpoint gera um commit (autor "Agente de IA" ou o humano) e uma avaliação completa.

## Análise

Com n = 3 por condição a análise é **descritiva**: média ± desvio-padrão, mediana e intervalo por
condição; diferença e variação percentual; **delta de Cliff** como tamanho de efeito (não
paramétrico, adequado a amostras pequenas). Não são feitos testes de significância — com 3 × 3
observações o menor p possível num teste de Mann–Whitney bilateral é 0,1. A análise quantitativa é
complementada pela qualitativa: registros manuais, diffs entre entrega e final, e exemplos de
violações (ver `docs/material-apresentacao.md`).

## Ameaças à validade

**Validade interna**
- *Não determinismo do modelo*: a mesma entrada pode gerar soluções diferentes. Mitigação: 3
  repetições por condição e relato da variabilidade.
- *Condutor humano*: o condutor conhece as hipóteses. Mitigação: intervenções geradas pelo kit,
  respostas padronizadas e regras de conduta fixas; tudo registrado na transcrição.
- *Ordem/tempo*: mitigado pela ordem contrabalançada.
- *Vazamento*: o agente poderia ler arquivos fora da pasta. Mitigação: pastas isoladas fora do
  repositório; as transcrições permitem auditar se isso aconteceu.

**Validade de construto**
- As regras RX são uma **operacionalização** do paradigma reativo; o verificador é estático e
  heurístico. Limitações conhecidas: não segue apelidos (`const l = this.mapa.get(id); l.x = 1`),
  RX07 usa nomes de arquivos/caminhos (`leil|lance|auction|bid` × `notif`).
- Como o harness ensina exatamente as regras medidas, a vantagem de B em violações é em parte **por
  construção** — o que se mede é justamente se o harness consegue fazer o agente seguir as regras
  do projeto. Para *erros*, a suíte oculta é independente e maior que os testes do harness (27 dos
  41 testes não têm correspondente no harness).
- "Intervenção" foi padronizada (o kit escreve a revisão); num time real a revisão humana seria
  mais lenta e menos completa, então o custo humano de A tende a estar **subestimado**.

**Validade externa**
- Uma tarefa, uma stack (NestJS/RxJS), um agente (Claude Code) e um modelo: os resultados não se
  generalizam automaticamente para outros contextos.
- O harness e o kit foram construídos com o auxílio de um modelo da mesma família do agente
  avaliado, o que pode favorecer a "compreensão" das instruções pelo agente.

**Validade de conclusão**
- n = 3 por condição: efeitos pequenos não são detectáveis; o relato é descritivo.
- Instabilidade do instrumento: testes dependentes de tempo foram estabilizados (ADR-008) e a suíte
  roda 2× por checkpoint (ADR-009); falhas intermitentes são relatadas à parte.

Próximo: [6. Instrumento de avaliação](06-instrumento-de-avaliacao.md).
