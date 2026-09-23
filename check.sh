#!/usr/bin/env bash
# Проверка всего проекта и запуск одной командой (из PowerShell: .\check.ps1):
#   1) зависимости  2) тесты бэкенда  3) типы и сборка фронта
#   4) смоук-тест всего сценария на изолированной копии (временная БД, порты 8001/5174)
#   5) если всё зелёное — запускает приложение (./run.sh) и открывает браузер
# Рабочая БД во время проверки не затрагивается.
#
#   ./check.sh             — проверить и запустить
#   ./check.sh --no-serve  — только проверить
#   ./check.sh --quick     — только тесты и сборка, без серверов
cd "$(dirname "$0")"
source scripts/common.sh

API_PORT=8001
WEB_PORT=5174
LOG_DIR=$(mktemp -d)
TMP_DB="$LOG_DIR/check.db"
# Windows-Python не понимает пути Git Bash (/tmp/...)
command -v cygpath >/dev/null && TMP_DB=$(cygpath -m "$TMP_DB")
STARTED=0
declare -a SUMMARY
FAILED=0

record() { # record <код> <название>
  if [ "$1" -eq 0 ]; then SUMMARY+=("✓ $2"); else SUMMARY+=("✗ $2"); FAILED=1; fi
}

cleanup() {
  if [ $STARTED -eq 1 ]; then
    kill $(jobs -p) 2>/dev/null
    kill_port $API_PORT
    kill_port $WEB_PORT
  fi
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT

# ---------- 1. Зависимости ----------
step "Зависимости"
setup_backend
record $? "Зависимости бэкенда"
setup_frontend
record $? "Зависимости фронта"
[ $FAILED -ne 0 ] && { red "Без зависимостей дальше нельзя"; exit 1; }

# ---------- 2. Тесты бэкенда ----------
step "Тесты бэкенда (pytest)"
(cd backend && "$VPY" -m pytest -q -p no:warnings)
record $? "Тесты бэкенда"

# ---------- 3. Фронт ----------
step "Проверка типов и сборка фронта"
npm run build --silent >"$LOG_DIR/build.log" 2>&1
code=$?
if [ $code -eq 0 ]; then green "  сборка прошла"; else tail -n 30 "$LOG_DIR/build.log"; fi
record $code "Сборка фронта (tsc + vite build)"

# ---------- 4. Смоук-тест на изолированной копии ----------
if [ "$1" != "--quick" ]; then
  step "Смоук-тест на изолированной копии (API :$API_PORT, фронт :$WEB_PORT, временная БД)"
  if port_busy $API_PORT || port_busy $WEB_PORT; then
    red "  порт $API_PORT или $WEB_PORT занят — пропускаю"
    record 1 "Смоук-тест (порты заняты)"
  else
    STARTED=1
    (cd backend && DATABASE_URL="sqlite:///$TMP_DB" "$VPY" -m uvicorn app.main:app --port $API_PORT >"$LOG_DIR/api.log" 2>&1) &
    API_URL="http://localhost:$API_PORT" node node_modules/vite/bin/vite.js --port $WEB_PORT --strictPort >"$LOG_DIR/web.log" 2>&1 &

    if wait_for "http://localhost:$API_PORT/api/health" 40 "API" && wait_for "http://localhost:$WEB_PORT" 40 "фронт"; then
      "$VPY" backend/tests/smoke.py "http://localhost:$WEB_PORT"
      record $? "Смоук-тест: черновик → рейтинг → каталог → отклик → выбор → этап"
    else
      red "  Серверы не поднялись. Логи:"
      tail -n 20 "$LOG_DIR/api.log" "$LOG_DIR/web.log"
      record 1 "Запуск серверов"
    fi
    kill $(jobs -p) 2>/dev/null
    kill_port $API_PORT
    kill_port $WEB_PORT
    STARTED=0
  fi
fi

# ---------- Итог ----------
step "Итог"
for line in "${SUMMARY[@]}"; do
  case $line in ✓*) green "  $line" ;; *) red "  $line" ;; esac
done
echo
if [ $FAILED -ne 0 ]; then
  red "ЕСТЬ ОШИБКИ — см. вывод выше"
  exit 1
fi
green "ВСЁ РАБОТАЕТ"

# ---------- 5. Запуск приложения ----------
if [ "$1" = "--no-serve" ] || [ "$1" = "--quick" ]; then
  echo "Запуск приложения: ./run.sh   (перед демо: ./run.sh --reset)"
  exit 0
fi
rm -rf "$LOG_DIR"
trap - EXIT
step "Запускаю приложение"
exec ./run.sh
