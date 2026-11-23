# Registro de decisões (ADRs)

Cada decisão importante, com contexto, alternativas e consequências. Datas: 23/11/2026.

---

## ADR-001 — Somente backend, com NestJS + RxJS

**Contexto.** O enunciado permite frontend ou backend. Foram consideradas NestJS (backend) e React + Vite (frontend).
**Decisão.** Somente backend, NestJS 12 + RxJS 7.
**Motivos.** (1) testes de API são simples e estáveis (HTTP + JSON), testes de UI exigem navegador simulado;
(2) o NestJS já usa RxJS (controllers podem devolver `Observable`, SSE nativo); no React a fronteira
"reativo × não reativo" fica difusa (hooks + estado local); (3) regras arquiteturais de backend são
verificáveis por ferramentas (módulos, camadas, dependências); (4) métricas objetivas.
**Consequência.** O experimento mede o paradigma no servidor; a interface é o stream SSE.

## ADR-002 — Domínio: leilão em tempo real

**Contexto.** Alternativas avaliadas: carrinho/fatura (exemplo dos slides), status de pedido de delivery
(PedeAiVai dos slides), monitor de sensores, placar ao vivo.
**Decisão.** Leilão em tempo real com prorrogação anti-sniping, encerramento automático, notificações e SSE.
**Motivos.** Tudo é evento; tem tempo (onde o imperativo mais sofre); tem observadores naturais; tem
concorrência; é testável por HTTP; cabe numa sessão de agente mas tem regras suficientes para errar.

## ADR-003 — Desenho: 2 condições × 3 repetições, ordem contrabalançada

**Decisão.** A (sem harness) × B (com harness), 3 execuções cada, ordem A1 B1 B2 A2 A3 B3, mesma tarefa
e mesmos critérios de parada (aprovado / 8 rodadas / 120 min).
**Motivos.** Repetições capturam o não determinismo do modelo; a ordem ABBAAB equilibra efeitos de ordem.
**Consequência.** Análise descritiva (n pequeno) — ver ADR-012.

## ADR-004 — Base sem os arquivos de agente do scaffold oficial

**Contexto.** O `@nestjs/cli` 12 gera `AGENTS.md`, `CLAUDE.md`, `.agents/skills`, `.claude/skills` e o
módulo de telemetria `@nestjs/observe` (com instruções para o agente sugerir a criação de conta).
**Decisão.** Remover tudo isso da base (evidência em `docs/evidencias/`).
**Motivo.** Sem a remoção, a condição A teria um "mini-harness" do fabricante e a comparação ficaria contaminada.
**Observação para o relatório.** O próprio ecossistema já entrega harnesses prontos — sinal da relevância do tema.

## ADR-005 — Execuções em pastas isoladas, com histórico importado como ramo

**Decisão.** Cada execução roda em `~/projetos-leilao/<ID>`, um repositório git próprio criado a partir
da base (+ harness). Ao finalizar, o histórico vira o ramo `execucoes/<ID>` do repositório principal
(tags `.../entrega` e `.../final`) e a pasta é apagada.
**Motivos.** O agente não pode ver o kit de avaliação, o gabarito nem outras execuções; o Claude Code lê
`CLAUDE.md` também das pastas-pai, então a pasta não pode ficar dentro do repositório principal.
O histórico completo continua disponível para `git log`/`git diff`.

## ADR-006 — Condução humana com intervenções padronizadas

**Decisão.** O aluno conduz as 6 execuções; o único feedback ao agente é o prompt de intervenção gerado
pelo kit, mais duas respostas padronizadas ("Siga a especificação..." e "Continue até concluir...").
**Motivos.** "Intervenção humana" é uma das três métricas pedidas, então um humano precisa estar no laço;
padronizar o conteúdo remove a subjetividade e torna a contagem replicável.
**Consequência.** O custo humano em A tende a estar subestimado (uma revisão real seria mais lenta).

## ADR-007 — Instrumento: testes caixa-preta + verificador estático, iguais para A e B

**Decisão.** Erros = suíte oculta de 41 testes HTTP contra o servidor real (`npm run start:prod`);
violações = verificador estático RX01–RX09 que não depende da estrutura de pastas.
**Motivos.** Testes caixa-preta valem para qualquer implementação (inclusive sem NestJS); subir o servidor
real evita falsos negativos de configurações feitas no `main.ts`; o verificador independente de
estrutura é justo com A, que não conhece as pastas exigidas pelo harness.
**Validação.** Gabarito (41/41, 0 violações) e anti-gabarito (41/41, 12 violações).

## ADR-008 — Encerramento guiado pelo prazo agendado

**Contexto.** O estresse da suíte mostrou falhas intermitentes no gabarito: em ~8% dos casos o temporizador
do Node dispara 1 ms antes de `Date.now()` alcançar o prazo, e o domínio concluía "ainda não venceu".
**Decisão.** O comando `EncerrarLeilao` carrega o prazo para o qual foi agendado; o domínio encerra se esse
prazo ainda é o vigente (e ignora o comando se houve prorrogação).
**Consequência.** 410/410 execuções verdes em 10 rodadas. A armadilha foi registrada no harness.

## ADR-009 — Suíte de aceitação 2× por checkpoint

**Decisão.** Cada avaliação roda a suíte duas vezes contra o mesmo servidor; um teste conta como falho se
falhar em qualquer repetição e é marcado como instável se oscilar.
**Motivo.** Bugs de tempo/concorrência são intermitentes; uma só rodada tornaria a contagem de erros ruidosa.
**Custo.** ~10 s a mais por checkpoint.

## ADR-010 — Hooks do Claude Code no harness

**Decisão.** `PostToolUse` (verificador RX no arquivo editado), `Stop` (roda `npm run validate`; se falhar,
bloqueia o encerramento e devolve os erros, até 3× por pedido do usuário) e `UserPromptSubmit` (zera o contador).
**Motivos.** Instruções sozinhas podem ser ignoradas; os hooks fecham o ciclo de feedback automaticamente.
O limite de 3 bloqueios (além do limite nativo de 8 continuações) evita laços infinitos.
**Formato.** Conferido na documentação oficial (versão 2.1.x) antes da implementação.

## ADR-011 — O harness contém padrões genéricos, não a solução

**Decisão.** `docs/arquitetura.md` traz trechos de código genéricos (Sink + `scan`, requisição/resposta sobre o
fluxo, `switchMap(timer)`, SSE como projeção, observador em outro módulo); nenhum arquivo do domínio de leilões.
**Motivo.** É o conhecimento que um time real colocaria no repositório; sem exemplos, regras como "derive o
estado do fluxo" são abstratas demais.
**Risco.** Aumenta a vantagem de B — que é exatamente o efeito que o experimento quer medir. Declarado como ameaça.

## ADR-012 — Análise descritiva com delta de Cliff

**Decisão.** Média ± DP, mediana, intervalo, diferença, variação % e delta de Cliff; sem testes de hipótese.
**Motivo.** Com 3 × 3 observações nenhum teste não paramétrico atinge p < 0,05; o delta de Cliff descreve
o quanto as distribuições se separam sem supor normalidade.

## ADR-013 — Testes do harness são um subconjunto da especificação

**Decisão.** 11 testes de contrato no harness; 41 na suíte oculta (27 sem correspondente).
**Motivo.** Se o harness tivesse os mesmos testes da avaliação, B "passaria por construção"; com a suíte
oculta maior, a métrica de erros mede a implementação da especificação.
