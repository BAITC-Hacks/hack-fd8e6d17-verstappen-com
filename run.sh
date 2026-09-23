#!/usr/bin/env bash
# Запуск бэкенда (FastAPI :8000) и фронта (Vite :5173) одной командой.
# Работает в macOS/Linux и Git Bash на Windows (из PowerShell: .\run.ps1).
#
#   ./run.sh           — запуск, открывает браузер
#   ./run.sh --reset   — то же, но БД пересоздаётся с тестовыми данными (перед демо)
#   NO_OPEN=1 ./run.sh — не открывать браузер
cd "$(dirname "$0")"
source scripts/common.sh

API_PORT=8000
WEB_PORT=5173

if port_busy $WEB_PORT && port_busy $API_PORT; then
  green "Приложение уже запущено"
  print_links $WEB_PORT $API_PORT " · остановить: закройте окно, где оно запущено"
  open_url "http://localhost:$WEB_PORT/"
  exit 0
fi

step "Зависимости"
setup_backend || exit 1
setup_frontend || exit 1

if [ "$1" = "--reset" ]; then
  step "Сброс БД к тестовым данным"
  (cd backend && "$VPY" -m app.seed --reset)
fi

stop() {
  echo
  echo "Останавливаю…"
  kill $(jobs -p) 2>/dev/null
  kill_port $API_PORT
  kill_port $WEB_PORT
}
trap stop EXIT
trap "exit 130" INT TERM

step "Запуск"
(cd backend && "$VPY" -m uvicorn app.main:app --reload --port $API_PORT --log-level warning) &
node node_modules/vite/bin/vite.js --port $WEB_PORT --strictPort --logLevel warn &

wait_for "http://localhost:$API_PORT/api/health" 40 "API" || exit 1
wait_for "http://localhost:$WEB_PORT" 40 "фронт" || exit 1

print_links $WEB_PORT $API_PORT
open_url "http://localhost:$WEB_PORT/"
wait
