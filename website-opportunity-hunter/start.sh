#!/usr/bin/env bash
# ===========================================================================
#  Website Opportunity Hunter — launcher for macOS and Linux.
#
#  The twin of start.cmd. Brings the dashboard up from a cold machine:
#  installs dependencies if they are missing, builds once, starts the server
#  and opens the browser when the port actually answers.
#
#  Closing this terminal stops the server. That is deliberate: a background
#  server nobody can see is a server nobody remembers to stop.
# ===========================================================================

set -uo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

echo
echo "  Website Opportunity Hunter"
echo "  =========================="
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
  echo "  If the database is unreachable, check that PostgreSQL is running."
  echo
  exit 1
}

# --- Already running? Just show it. -----------------------------------------
if port_open; then
  echo "  Already running. Opening ${URL}"
  open_browser
  exit 0
fi

# --- Node --------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed, or not on the PATH. Install the LTS build from https://nodejs.org"
fi

# --- Configuration -----------------------------------------------------------
if [ ! -f .env ]; then
  fail "No .env file yet, so the app does not know which database to use. Run: npm run setup"
fi

# --- Dependencies, migrations and build --------------------------------------
# One script, shared with start.cmd, so the two launchers cannot drift. It
# installs if needed, applies pending migrations, and rebuilds when the code has
# changed since the last build — which is what makes a git pull actually show up
# instead of serving the previous build.
node scripts/prepare.mjs || exit 1

# --- Open the browser once the port answers ----------------------------------
(
  for _ in $(seq 1 90); do
    if port_open; then open_browser; break; fi
    sleep 1
  done
) &

echo "  Starting the server. This terminal keeps it running."
echo "  Press Ctrl+C to stop."
echo
echo "  ${URL}"
echo

npm start || fail "The server stopped with an error."
