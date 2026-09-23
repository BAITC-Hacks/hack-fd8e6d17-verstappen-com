"""Точка входа бэкенда на Vercel: все запросы /api/* попадают сюда (см. vercel.json).

Код бэкенда живёт в backend/app — добавляем его в путь импорта и отдаём то же FastAPI-приложение,
что и локально. Vercel не гарантирует запуск lifespan-событий, поэтому таблицы и тестовые данные
создаём при холодном старте функции (если база пустая).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402

seed_if_empty()

__all__ = ["app"]
