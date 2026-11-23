#!/usr/bin/env bash
# Checklist de ambiente antes das execuções (ver experimento/protocolo.md, passo 0).
# Só verifica e sugere correções; não altera nada.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ok=0; aviso=0; erro=0
passa()  { echo "  ✔ $*"; ok=$((ok+1)); }
avisa()  { echo "  ⚠ $*"; aviso=$((aviso+1)); }
falha()  { echo "  ✖ $*"; erro=$((erro+1)); }

echo "1) Node.js visível para processos NÃO interativos (o agente e os hooks usam esse PATH)"
NODE_LOGIN=$(env -i HOME="$HOME" bash -lc 'command -v node; node --version' 2>/dev/null | tr '\n' ' ')
NPM_LOGIN=$(env -i HOME="$HOME" bash -lc 'command -v npm' 2>/dev/null)
if [[ "$NODE_LOGIN" == *v24* && -n "$NPM_LOGIN" ]]; then
  passa "node e npm encontrados: $NODE_LOGIN"
else
  falha "node/npm não estão no PATH de shells não interativos (só no ~/.bashrc)."
  NODE_DIR=$(ls -d /usr/local/node-v24*/bin 2>/dev/null | head -1)
  echo "     Correção sugerida (cria atalhos em ~/.local/bin, que já está no PATH):"
  echo "       mkdir -p ~/.local/bin && ln -sf ${NODE_DIR:-/caminho/do/node}/{node,npm,npx} ~/.local/bin/"
  echo "     Depois feche e reabra o VS Code."
fi

echo "2) Claude Code"
if command -v claude > /dev/null 2>&1; then passa "CLI: $(claude --version 2>/dev/null)"; else avisa "CLI 'claude' não encontrada no PATH (a extensão do VS Code tem a própria versão; anote-a no registro)"; fi

echo "3) Configurações globais do Claude Code que afetam TODAS as execuções"
if [ -s "$HOME/.claude/CLAUDE.md" ]; then
  avisa "existe ~/.claude/CLAUDE.md (instruções globais): mantenha-o IGUAL durante as 6 execuções e anote no relatório"
else
  passa "sem ~/.claude/CLAUDE.md global"
fi
if grep -q '"hooks"' "$HOME/.claude/settings.json" 2>/dev/null; then
  avisa "~/.claude/settings.json tem hooks globais: eles valem para A e B; anote no relatório"
else
  passa "sem hooks globais em ~/.claude/settings.json"
fi

echo "4) Git"
if [ -n "$(git config user.name)" ] && [ -n "$(git config user.email)" ]; then passa "identidade configurada ($(git config user.name))"; else falha "configure git config --global user.name/user.email"; fi
if [ -z "$(git -C "$RAIZ" status --porcelain --untracked-files=no)" ]; then passa "repositório principal sem alterações pendentes"; else avisa "há alterações não commitadas no repositório principal (o preparar exige tudo commitado)"; fi

echo "5) Pasta das execuções"
DIR="${EXECUCOES_DIR:-$HOME/projetos-leilao}"
if [ -d "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  avisa "$DIR já contém: $(ls "$DIR" | tr '\n' ' ') (pastas de execuções em andamento?)"
else
  passa "$DIR livre"
fi

echo "6) Kit de avaliação"
if [ -d "$RAIZ/avaliacao/node_modules" ]; then passa "dependências do kit instaladas"; else falha "rode: (cd avaliacao && npm ci)"; fi

echo
echo "Resultado: $ok ok, $aviso aviso(s), $erro erro(s)."
[ $erro -eq 0 ]
