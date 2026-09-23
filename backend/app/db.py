import os
from pathlib import Path

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

# .env читается здесь, чтобы сервер, сброс БД (python -m app.seed) и любые скрипты
# работали с одной и той же базой. Уже заданные переменные окружения не перезаписываются.
load_dotenv()

# На Vercel файловая система только для чтения (кроме /tmp) и не сохраняется между вызовами:
# там нужен внешний PostgreSQL. SQLite в /tmp — лишь чтобы приложение не падало без него.
ON_VERCEL = bool(os.getenv("VERCEL"))
DATA_DIR = Path("/tmp") if ON_VERCEL else Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# POSTGRES_URL — так переменную называет интеграция Neon / Vercel Postgres
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or f"sqlite:///{DATA_DIR / 'app.db'}"

# The application and SQLModel sessions are synchronous. Accept asyncpg URLs in
# .env, but route them through psycopg so create_engine/Session remain compatible.
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)

# Для PostgreSQL — таймаут подключения: без него при выключенном сервере БД запуск висит молча
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {"connect_timeout": 5}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


def init_db() -> None:
    from app import models  # noqa: F401  (регистрирует таблицы)

    SQLModel.metadata.create_all(engine)


def drop_db() -> None:
    SQLModel.metadata.drop_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
