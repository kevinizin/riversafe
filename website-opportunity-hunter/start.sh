#!/usr/bin/env bash
# ===========================================================================
#  Azven — launcher para macOS e Linux.
#
#  O gêmeo do start.cmd. Sobe o painel a partir de uma máquina fria: instala
#  dependências se faltarem, aplica migrações, compila quando o código mudou,
#  inicia o servidor e abre o navegador quando a porta realmente responde.
#
#  Fechar este terminal desliga o servidor. Isso é proposital: um servidor
#  rodando escondido é um servidor que ninguém lembra de desligar.
# ===========================================================================

set -uo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

echo
echo "  Azven"
echo "  ====="
echo

port_open() {
  # A bash-only TCP probe: no nc, lsof or curl needed.
  (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") >/dev/null 2>&1
}

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 &
  fi
}

fail() {
  echo
  echo "  $1"
  echo
  echo "  Se o banco estiver inacessível, confira se o PostgreSQL está rodando."
  echo
  exit 1
}

# --- Already running? Just show it. -----------------------------------------
if port_open; then
  echo "  Já está rodando. Abrindo ${URL}"
  open_browser
  exit 0
fi

# --- Node --------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  fail "O Node.js não está instalado, ou não está no PATH. Instale a versão LTS em https://nodejs.org"
fi

# --- Configuration -----------------------------------------------------------
if [ ! -f .env ]; then
  fail "Ainda não existe o arquivo .env, então o sistema não sabe qual banco usar. Rode: npm run setup"
fi

# --- Dependências, migrações e build -----------------------------------------
# Um script só, compartilhado com o start.cmd, para os dois launchers não
# divergirem. Ele instala se precisar, aplica as migrações pendentes e recompila
# quando o código mudou desde o último build — que é o que faz um git pull
# realmente aparecer em vez de servir o build anterior.
node scripts/prepare.mjs || exit 1

# --- Open the browser once the port answers ----------------------------------
(
  for _ in $(seq 1 90); do
    if port_open; then open_browser; break; fi
    sleep 1
  done
) &

echo "  Iniciando o servidor. Este terminal é que o mantém no ar."
echo "  Aperte Ctrl+C para desligar."
echo
echo "  ${URL}"
echo

npm start || fail "O servidor parou com um erro."
