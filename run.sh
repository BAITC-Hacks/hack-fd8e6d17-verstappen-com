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
  open_url "http://$HOST:$WEB_PORT/"
  exit 0
fi

step "Зависимости"
setup_backend || exit 1
setup_frontend || exit 1

step "База данных"
ensure_postgres || exit 1

if [ "$1" = "--reset" ]; then
  step "Сброс БД к тестовым данным"
  (cd backend && "$VPY" -m app.seed --reset) || exit 1
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
(cd backend && exec "$VPY" -m uvicorn app.main:app --reload --host $HOST --port $API_PORT --log-level warning) &
API_PID=$!
API_URL="http://$HOST:$API_PORT" node node_modules/vite/bin/vite.js --host $HOST --port $WEB_PORT --strictPort --logLevel warn &
WEB_PID=$!

wait_for "http://$HOST:$API_PORT/api/health" 60 "API" $API_PID || exit 1
wait_for "http://$HOST:$WEB_PORT" 60 "фронт" $WEB_PID || exit 1

print_links $WEB_PORT $API_PORT
open_url "http://$HOST:$WEB_PORT/"
wait
