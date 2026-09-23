#!/usr/bin/env bash
# Полная проверка проекта одной командой:
#   1) зависимости  2) тесты бэкенда  3) типы и сборка фронта
#   4) поднимает изолированную копию (временная БД, порты 8001/5174)
#   5) смоук-тест всего сценария через фронт  6) всё гасит и печатает итог
# Рабочая БД и запущенный ./run.sh не затрагиваются.
#
#   ./check.sh          — полная проверка
#   ./check.sh --quick  — без запуска серверов (только тесты и сборка)
cd "$(dirname "$0")"

API_PORT=8001
WEB_PORT=5174
LOG_DIR=$(mktemp -d)
TMP_DB="$LOG_DIR/check.db"
# Windows-Python не понимает пути Git Bash (/tmp/...)
command -v cygpath >/dev/null && TMP_DB=$(cygpath -m "$TMP_DB")
PIDS=()
declare -a SUMMARY
FAILED=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
record() { # record <код> <название>
  if [ "$1" -eq 0 ]; then SUMMARY+=("✓ $2"); else SUMMARY+=("✗ $2"); FAILED=1; fi
}

kill_port() { # гасит процесс, слушающий порт (надёжнее kill: npx/uvicorn порождают дочерние процессы)
  if command -v powershell >/dev/null; then
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
  elif command -v lsof >/dev/null; then
    lsof -ti "tcp:$1" -sTCP:LISTEN | xargs kill 2>/dev/null
  fi
}

cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  if [ ${#PIDS[@]} -gt 0 ]; then kill_port $API_PORT; kill_port $WEB_PORT; fi
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT

wait_for() { # wait_for <url> <секунд>
  for _ in $(seq 1 "$2"); do
    curl -sf "$1" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

port_busy() { curl -s -o /dev/null "http://localhost:$1" 2>/dev/null; }

# ---------- 1. Зависимости ----------
step "Зависимости"
PY=$(command -v python3 || command -v python)
[ -z "$PY" ] && { red "Не найден Python"; exit 1; }
command -v npm >/dev/null || { red "Не найден Node.js / npm"; exit 1; }
[ -d backend/.venv ] || "$PY" -m venv backend/.venv
if [ -f backend/.venv/Scripts/python.exe ]; then VPY="$PWD/backend/.venv/Scripts/python.exe"; else VPY="$PWD/backend/.venv/bin/python"; fi
"$VPY" -m pip install -q -r backend/requirements.txt --disable-pip-version-check
record $? "Зависимости бэкенда"
[ -d node_modules ] || npm install --silent
record $? "Зависимости фронта"

# ---------- 2. Тесты бэкенда ----------
step "Тесты бэкенда (pytest)"
(cd backend && "$VPY" -m pytest -q -p no:warnings)
record $? "Тесты бэкенда"

# ---------- 3. Фронт ----------
step "Проверка типов и сборка фронта"
npm run build --silent >"$LOG_DIR/build.log" 2>&1
code=$?
[ $code -ne 0 ] && tail -30 "$LOG_DIR/build.log"
record $code "Сборка фронта (tsc + vite build)"

# ---------- 4–5. Живой запуск и смоук-тест ----------
if [ "$1" != "--quick" ]; then
  step "Запуск изолированной копии: API :$API_PORT, фронт :$WEB_PORT"
  if port_busy $API_PORT || port_busy $WEB_PORT; then
    red "Порт $API_PORT или $WEB_PORT занят — пропускаю смоук-тест"
    record 1 "Смоук-тест (порты заняты)"
  else
    (cd backend && DATABASE_URL="sqlite:///$TMP_DB" "$VPY" -m uvicorn app.main:app --port $API_PORT >"$LOG_DIR/api.log" 2>&1) &
    PIDS+=($!)
    API_URL="http://localhost:$API_PORT" node node_modules/vite/bin/vite.js --port $WEB_PORT --strictPort >"$LOG_DIR/web.log" 2>&1 &
    PIDS+=($!)

    if wait_for "http://localhost:$API_PORT/api/health" 30 && wait_for "http://localhost:$WEB_PORT" 30; then
      step "Смоук-тест сценария через фронт"
      "$VPY" backend/tests/smoke.py "http://localhost:$WEB_PORT"
      record $? "Смоук-тест: черновик → рейтинг → каталог → отклик → выбор → этап"
    else
      red "Серверы не поднялись. Логи:"
      tail -n 20 "$LOG_DIR/api.log" "$LOG_DIR/web.log"
      record 1 "Запуск серверов"
    fi
  fi
fi

# ---------- Итог ----------
step "Итог"
for line in "${SUMMARY[@]}"; do
  case $line in ✓*) green "  $line" ;; *) red "  $line" ;; esac
done
echo
if [ $FAILED -eq 0 ]; then
  green "ВСЁ РАБОТАЕТ. Запуск для демо: ./run.sh --reset"
else
  red "ЕСТЬ ОШИБКИ — см. вывод выше"
fi
exit $FAILED
