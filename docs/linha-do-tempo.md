# Linha do tempo do trabalho

Registro cronológico de tudo o que foi feito: decisões, construção, problemas encontrados e correções.
Horários no fuso de Brasília (UTC−3). O histórico completo de alterações está no `git log`
(ver também `docs/historico-git.md`, gerado por `scripts/gerar-historico-git.sh`).
As referências "ADR-xxx" apontam para [`decisoes.md`](decisoes.md).

## 23/11/2026 — Entendimento e planejamento

- **09:47** — Enunciado e slides da disciplina (Paradigmas de Linguagens de Programação, Prof. Thiago de Sales) colocados na pasta do projeto.
- **10:01** — Leitura do enunciado: construir um *harness* para agentes de IA focado em Programação Reativa/Orientada a Eventos e comparar a mesma funcionalidade **com e sem harness** (erros, violações arquiteturais, intervenções humanas).
- **10:06** — Stack escolhida: Node.js. Avaliadas as opções NestJS (backend) e React + Vite (frontend).
- **10:09** — Decisão: **somente backend (NestJS + RxJS)**. Motivos: testes de API mais simples e estáveis, RxJS nativo no NestJS, regras arquiteturais verificáveis por ferramentas e métricas objetivas (ADR-001).
- **10:10** — Domínio escolhido: **leilão em tempo real** (lances, anti-sniping, encerramento automático, notificações, SSE) — ver ADR-002.
- **10:14** — Requisito do aluno: projeto mais completo, 100% focado no enunciado, documentado, replicável e com uso de git para rastrear acertos, erros e correções.
- **10:18** — Decisões de protocolo: git apenas local; **3 repetições por condição** (A1–A3 sem harness, B1–B3 com harness); tudo documentado com linha do tempo para virar slides e relatório.
- **10:19** — Decisão: o próprio aluno conduz as 6 execuções em sessões novas do Claude Code, seguindo um roteiro padronizado (ADR-006).

## 23/11/2026 — Construção da infraestrutura do experimento

- **10:28** — Repositório git criado; enunciado versionado (`00f004f`).
- **10:30** — Projeto base gerado com `@nestjs/cli` 12.0.15. **Achado:** o gerador oficial já cria `AGENTS.md`, `CLAUDE.md` e skills de agente, além de telemetria externa (`@nestjs/observe`). Tudo foi removido da base para que a condição A seja de fato "sem harness"; evidência guardada em `docs/evidencias/` (ADR-004). Base versionada (`7752172`).
- **10:33** — Especificação da tarefa escrita (`experimento/prompts/tarefa.md`): contrato HTTP completo, idêntico para A e B.
- **10:35** — Gabarito (implementação reativa de referência) escrito para validar o instrumento: domínio puro (decidir/evoluir), Sink de comandos com `scan`, log de eventos com replay, projeções, temporizador com `switchMap(timer)`, SSE.
- **10:38** — Suíte de aceitação oculta (41 testes caixa-preta via HTTP) escrita. Problema: a variável `BASE_URL` colidia com `import.meta.env.BASE_URL` do Vite; renomeada para `URL_ALVO`. Resultado: gabarito 41/41.
- **10:40** — Verificador de regras reativas (RX01–RX09) escrito com a API do compilador TypeScript: gabarito com 0 violações.
- **10:41** — Anti-gabarito (implementação imperativa típica: `Map` mutável, `setTimeout`, `Subject` público, leilões chamando notificações) escrito: **41/41 testes e 12 violações**, o que prova que os testes medem funcionalidade e o verificador mede paradigma.
- **10:42** — 10 casos de teste do próprio verificador (um por regra + código correto): todos passam. Commit `14ca6a7`.
- **10:44** — Harness montado: `AGENTS.md`/`CLAUDE.md`, `docs/arquitetura.md`, `docs/regras-reativas.md`, dependency-cruiser (camadas), verificador de estrutura, testes de contrato, `npm run validate` e hooks do Claude Code (formato confirmado na documentação oficial da versão 2.1.x).
- **10:46** — Problema: o dependency-cruiser 18.9 não aceitava `extensionAlias`; resolvido com `tsConfig` (os imports `.js` passam a resolver para `.ts`).
- **10:51** — Problema: o oxlint respeita o `.gitignore` do repositório pai e não encontrava arquivos nos projetos de teste; resolvido fazendo de cada projeto montado um repositório git próprio.
- **10:52** — Gabarito + harness: `npm run validate` com 7/7 etapas verdes (~13 s). Hooks testados com entradas simuladas (bloqueio do Stop 3×, liberação, reset no novo prompt). Commit `dfd0d06`.
- **10:56** — Avaliador de checkpoints (`avaliacao/avaliar.mjs`) escrito.
- **10:57** — **Problema importante:** um teste de stream falhou no gabarito. Teste de estresse (8 rodadas) mostrou falhas intermitentes nos testes de tempo.
- **10:59** — Causa encontrada: o temporizador do Node dispara ~1 ms **antes** de `Date.now()` alcançar o prazo em 8% dos casos (24/300 medidos). O gabarito concluía "ainda não venceu" e o leilão nunca encerrava. Correção: o comando de encerramento carrega o prazo agendado (ADR-008). Depois da correção: 10 rodadas, 410/410 execuções verdes.
- **11:00** — Avaliador passa a rodar a suíte 2× por checkpoint e marca testes instáveis (ADR-009). A armadilha do temporizador foi registrada na documentação do harness. Commit `2cb2330`.
- **11:03** — Analisador de transcrições do Claude Code (`scripts/analisar-sessao.mjs`) escrito e testado na própria sessão de construção.
- **11:05** — Scripts de condução do experimento (`preparar`, `checkpoint`, `finalizar`, `status`) escritos. Commit `febccaf`.
- **11:06** — **Ensaio do protocolo** (dados sintéticos): ENSAIO-A (entrega = anti-gabarito → 12 violações → prompt de intervenção gerado → correção = gabarito → aprovado → finalizada, histórico importado como ramo) e ENSAIO-B (harness; hooks simulados; aprovado na entrega). Fluxo completo validado.
- **11:10** — Consolidação de resultados com estatística descritiva, delta de Cliff e 6 gráficos SVG (paleta validada para daltonismo). Revisão visual dos gráficos renderizados: subtítulo cortado e rótulo encostado na margem corrigidos.
- **11:11** — Correção de métrica: "casos de teste escritos pelo agente" passou a excluir os testes herdados da base/harness (antes, B contava os 11 testes de contrato como se fossem do agente).
- **11:12** — Checklist de ambiente (`scripts/verificar-ambiente.sh`): detectou que o Node não está no PATH de processos não interativos — correção documentada no protocolo (passo 0). Gerador do histórico git. Commit `5e1fbb5`.
- **11:14** — Documentação: protocolo das execuções, visão geral, fundamentação reativa, sistema, harness, metodologia (com ameaças à validade), instrumento de avaliação (com tabela de sobreposição harness × suíte oculta: 7 ✓, 7 ◐, 27 ✗), decisões (ADR-001 a ADR-013), material para slides/relatório e README.
- **11:20** — Ensaio refeito com a versão definitiva dos scripts (incluindo o caminho de edição manual): ENSAIO-A aprovada com 2 intervenções, ENSAIO-B aprovada sem intervenções. Gráficos revisados (folga no topo da escala).
- **11:22** — Verificação final: testes do verificador 10/10; camadas `base` e `harness` conferidas; temporários removidos. **Infraestrutura pronta para as execuções A1–B3.**
- **Pendente antes da primeira execução:** tornar o Node visível para processos não interativos (protocolo, passo 0).

## Execuções do experimento (registro automático)

As linhas abaixo são acrescentadas automaticamente pelos scripts do experimento.

- **23/11/2026, 11:30** — `A1` preparada (sem harness): pasta `~/projetos-leilao/A1`, commit inicial `fe374bc2`
- **23/11/2026, 11:37** — `B1` preparada (com harness): pasta `~/projetos-leilao/B1`, commit inicial `0f605cae`
- **23/11/2026, 11:39** — `B1` checkpoint 1 (entrega) — commit `d4921ab8` — aprovado (build ok, 0 testes falhando, 0 violações)
