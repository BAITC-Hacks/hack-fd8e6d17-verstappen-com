#!/usr/bin/env bash
# Запуск бэкенда (FastAPI :8000) и фронта (Vite :5173) одной командой.
# Работает в macOS/Linux и Git Bash на Windows.
set -e
cd "$(dirname "$0")"

PY=$(command -v python3 || command -v python)

if [ ! -d backend/.venv ]; then
  echo "→ Создаю виртуальное окружение"
  "$PY" -m venv backend/.venv
fi
if [ -f backend/.venv/Scripts/python.exe ]; then
  VPY=backend/.venv/Scripts/python.exe
else
  VPY=backend/.venv/bin/python
fi

echo "→ Устанавливаю зависимости бэкенда"
"$VPY" -m pip install -q -r backend/requirements.txt

if [ ! -d node_modules ]; then
  echo "→ Устанавливаю зависимости фронта"
  npm install
fi

if [ "$1" = "--reset" ]; then
  (cd backend && "../$VPY" -m app.seed --reset)
fi

(cd backend && "../$VPY" -m uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT

echo "→ API:     http://localhost:8000/docs"
echo "→ Фронт:   http://localhost:5173"
npm run dev
