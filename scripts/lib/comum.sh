# Funções e variáveis compartilhadas pelos scripts (carregar com: source scripts/lib/comum.sh)

# Node.js: nesta máquina o Node 24 não está no PATH de shells não interativos.
if ! command -v node > /dev/null 2>&1; then
  for d in /usr/local/node-v24*/bin "$HOME"/.nvm/versions/node/v24*/bin; do
    [ -x "$d/node" ] && export PATH="$d:$PATH" && break
  done
fi
command -v node > /dev/null 2>&1 || { echo "erro: Node.js 24 não encontrado no PATH" >&2; exit 1; }

RAIZ="${RAIZ:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Onde ficam as pastas de trabalho das execuções (fora do repositório, para o agente
# não enxergar o kit de avaliação, o gabarito nem outras execuções).
EXECUCOES_DIR="${EXECUCOES_DIR:-$HOME/projetos-leilao}"

# Critérios de parada do protocolo (ver experimento/protocolo.md)
MAX_RODADAS="${MAX_RODADAS:-8}"
MAX_MINUTOS="${MAX_MINUTOS:-120}"

agora_iso() { date '+%Y-%m-%dT%H:%M:%S%z'; }
agora_legivel() { date '+%d/%m/%Y %H:%M'; }

validar_id() {
  [[ "$1" =~ ^[AB][1-3]$ || "$1" =~ ^ENSAIO[0-9]*$ ]] || {
    echo "erro: ID de execução inválido: '$1' (use A1..A3, B1..B3 ou ENSAIO)" >&2; exit 2; }
}

grupo_do_id() {
  case "$1" in A*) echo A ;; B*) echo B ;; ENSAIO*) echo "${GRUPO_ENSAIO:-A}" ;; esac
}
