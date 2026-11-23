# Harness para agentes de IA — Programação Reativa

Trabalho prático de **Paradigmas de Linguagens de Programação** (UFAL — Campus Arapiraca).

> *Prepare um repositório com instruções para agentes, regras arquiteturais, testes, lint e scripts de
> validação focado em Programação Reativa/Orientada a Eventos. Implemente a mesma funcionalidade com e
> sem o harness e compare a quantidade de erros, violações arquiteturais e intervenções humanas.*

**Funcionalidade:** API de **leilões em tempo real** (NestJS + RxJS): lances, prorrogação anti-sniping,
encerramento automático, notificações e stream SSE.
**Experimento:** o mesmo agente de IA (Claude Code) implementa a mesma funcionalidade 3 vezes **sem**
harness (A1–A3) e 3 vezes **com** harness (B1–B3); um kit de avaliação oculto mede erros, violações e
intervenções em cada etapa; tudo fica registrado no git.

## Situação

| Etapa | Estado |
|---|---|
| Base NestJS limpa (`projetos/base`) | ✅ pronta |
| Harness (`projetos/harness`) | ✅ pronto e validado com o gabarito (`npm run validate` 7/7) |
| Kit de avaliação (`avaliacao/`) | ✅ pronto e validado (gabarito 41/41 e 0 violações; anti-gabarito 41/41 e 12 violações; estresse 410/410) |
| Scripts do experimento + ensaio do protocolo | ✅ prontos (ensaio em `experimento/ensaio/`, dados sintéticos) |
| Execuções A1–A3 e B1–B3 | ⏳ a fazer — por um agente condutor seguindo [`experimento/ROTEIRO-CONDUTOR.md`](experimento/ROTEIRO-CONDUTOR.md) (ou manualmente: [`experimento/protocolo.md`](experimento/protocolo.md)) |
| Resultados consolidados | ⏳ após as execuções (`node scripts/consolidar-resultados.mjs`) |

Andamento das execuções a qualquer momento: `scripts/status-execucoes.sh`.

## Começo rápido (para conduzir as execuções)

```bash
scripts/verificar-ambiente.sh          # 1. checklist (corrija o que aparecer com ✖)
scripts/preparar-execucao.sh A1 --abrir  # 2. prepara a execução e abre a pasta no VS Code
#   3. cole experimento/prompts/tarefa.md numa conversa NOVA do Claude Code
scripts/checkpoint.sh A1 entrega       # 4. quando o agente terminar
#   5. se houver problemas: cole o prompt de intervenção gerado e depois
scripts/checkpoint.sh A1 correcao      #    (repita até aprovar)
scripts/finalizar-execucao.sh A1       # 6. importa o histórico, copia a sessão e gera o resumo
```

Ordem: **A1 → B1 → B2 → A2 → A3 → B3**. Detalhes e regras de conduta: [`experimento/protocolo.md`](experimento/protocolo.md).

## Estrutura

```
├── Instruções.txt              enunciado original
├── docs/                       documentação (ver índice abaixo)
├── projetos/
│   ├── base/                   NestJS 12 limpo — o que a condição A recebe
│   └── harness/                camada de harness — somada à base na condição B
├── experimento/
│   ├── prompts/tarefa.md       a especificação entregue ao agente (idêntica em A e B)
│   ├── protocolo.md            roteiro passo a passo das execuções
│   ├── execucoes/<ID>/         registros, checkpoints, sessão e resumo de cada execução
│   ├── resultados/             tabelas, CSV e gráficos consolidados
│   └── ensaio/                 ensaio do protocolo (dados sintéticos)
├── avaliacao/                  kit de avaliação OCULTO (suíte de 41 testes, avaliador, gabarito, anti-gabarito)
└── scripts/                    condução do experimento, consolidação e utilitários
```

## Documentação

1. [Visão geral](docs/01-visao-geral.md) — o que é um harness, pergunta de pesquisa e hipóteses
2. [Fundamentação: programação reativa](docs/02-fundamentacao-reativa.md) — conceitos dos slides no projeto
3. [O sistema de leilões](docs/03-sistema-leilao.md)
4. [O harness](docs/04-harness.md) — componentes, regras RX01–RX09, validação, hooks
5. [Metodologia](docs/05-metodologia.md) — desenho, controles, métricas, ameaças à validade
6. [Instrumento de avaliação](docs/06-instrumento-de-avaliacao.md) — suíte oculta, verificador e sua validação
- [Decisões (ADRs)](docs/decisoes.md) · [Linha do tempo](docs/linha-do-tempo.md) · [Histórico git](docs/historico-git.md)
- [Material para slides e relatório](docs/material-apresentacao.md)

## Reproduzir do zero

Requisitos: Linux/macOS, Node.js 24, git, Claude Code (CLI ou extensão do VS Code).

```bash
(cd avaliacao && npm ci)                              # dependências do kit
(cd avaliacao && npm run test:verificador)            # testes do verificador (10/10)
scripts/lib/montar-projeto.sh /tmp/ref harness --overlay avaliacao/referencia
(cd /tmp/ref && npm run validate)                     # gabarito passa no harness
node avaliacao/avaliar.mjs --projeto /tmp/ref --saida /tmp/aval   # gabarito aprovado
```

Depois, siga o protocolo para executar o experimento. As versões usadas (Node, NestJS, RxJS,
TypeScript, Vitest, oxlint, dependency-cruiser) estão fixadas nos `package-lock.json`.
