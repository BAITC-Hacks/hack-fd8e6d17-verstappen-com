# Общие функции для run.sh и check.sh (подключается через source).

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

# Находит рабочий Python. На Windows python3 часто ведёт на заглушку Microsoft Store.
find_python() {
  for cmd in python python3 py; do
    if command -v "$cmd" >/dev/null && "$cmd" -c "import sys; sys.exit(sys.version_info < (3, 11))" 2>/dev/null; then
      echo "$cmd"
      return 0
    fi
  done
  return 1
}

# Создаёт venv и ставит зависимости бэкенда. Результат: переменная VPY.
setup_backend() {
  local py
  py=$(find_python) || { red "Не найден Python 3.11+. Установите с python.org"; return 1; }
  if [ ! -d backend/.venv ]; then
    echo "  создаю виртуальное окружение…"
    "$py" -m venv backend/.venv || return 1
  fi
  if [ -f backend/.venv/Scripts/python.exe ]; then
    VPY="$PWD/backend/.venv/Scripts/python.exe"
  else
    VPY="$PWD/backend/.venv/bin/python"
  fi
  "$VPY" -m pip install -q -r backend/requirements.txt --disable-pip-version-check
}

setup_frontend() {
  command -v npm >/dev/null || { red "Не найден Node.js / npm. Установите с nodejs.org"; return 1; }
  if [ ! -d node_modules ]; then
    echo "  npm install…"
    npm install --silent || return 1
  fi
}

# Серверы слушают 127.0.0.1 явно: на Windows «localhost» может резолвиться в IPv6 ::1,
# и тогда сервер и проверка «не видят» друг друга.
HOST=127.0.0.1

port_busy() { curl -s -o /dev/null --max-time 2 "http://$HOST:$1" 2>/dev/null; }

# wait_for <url> <секунд> <название> [pid] [лог]
# Ждёт ответа с индикатором. Если процесс pid умер — сразу показывает лог и выходит.
wait_for() {
  printf '  жду %s ' "$3"
  local start=$SECONDS
  while [ $((SECONDS - start)) -lt "$2" ]; do
    if curl -sf --max-time 3 "$1" >/dev/null 2>&1; then
      green "готово ($((SECONDS - start)) сек)"
      return 0
    fi
    if [ -n "$4" ] && ! kill -0 "$4" 2>/dev/null; then
      red " процесс завершился с ошибкой"
      [ -n "$5" ] && [ -f "$5" ] && { echo "  --- лог ($5) ---"; tail -n 25 "$5" | sed 's/^/  /'; }
      return 1
    fi
    printf '.'
    sleep 1
  done
  red " не ответил за $2 сек"
  [ -n "$5" ] && [ -f "$5" ] && { echo "  --- лог ($5) ---"; tail -n 25 "$5" | sed 's/^/  /'; }
  return 1
}

# Гасит всё, что слушает порт, вместе с дочерними процессами.
# На Windows uvicorn --reload держит порт в дочернем процессе, который переживает смерть родителя,
# поэтому убиваем и дерево (taskkill /T), и детей уже умершего владельца.
kill_port() {
  if command -v powershell >/dev/null; then
    powershell -NoProfile -Command "
      Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
          taskkill /F /T /PID \$_ 2>\$null | Out-Null
          Get-CimInstance Win32_Process -Filter \"ParentProcessId=\$_\" | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }
        }" >/dev/null 2>&1
  elif command -v lsof >/dev/null; then
    lsof -ti "tcp:$1" -sTCP:LISTEN | xargs kill 2>/dev/null
  fi
}

# Открывает ссылку в браузере по умолчанию. Отключить: NO_OPEN=1
open_url() {
  [ -n "$NO_OPEN" ] && return 0
  if command -v powershell >/dev/null; then
    powershell -NoProfile -Command "Start-Process '$1'" >/dev/null 2>&1 &
  elif command -v open >/dev/null; then
    open "$1"
  elif command -v xdg-open >/dev/null; then
    xdg-open "$1" >/dev/null 2>&1 &
  fi
}

print_links() { # print_links <порт фронта> <порт API> [хвост подсказки]
  echo
  bold "  ┌─ Приложение запущено ─────────────────────────────"
  echo "  │  Лендинг:        http://$HOST:$1/"
  echo "  │  Команда:        http://$HOST:$1/#/team"
  echo "  │  Бизнес:         http://$HOST:$1/#/business"
  echo "  │  API (Swagger):  http://$HOST:$2/docs"
  bold "  └─ Ctrl+ЛКМ по ссылке — открыть${3:- · Ctrl+C — остановить}"
  echo
}
