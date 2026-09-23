import os
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app import scoring  # noqa: E402
from app.routers import ai, proposals, tasks, teams  # noqa: E402
from app.schemas import CARD_FIELDS, FIELD_LABELS, TOPICS  # noqa: E402
from app.seed import load_seed, reset, seed_if_empty  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_if_empty()
    yield


app = FastAPI(
    title="AI Sana — каталог бизнес-задач",
    description="Черновик → уточнение → карточка → рейтинг → каталог → отклик → выбор бизнеса",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (ai.router, tasks.router, proposals.router, teams.router):
    app.include_router(r)


@app.get("/api/health", tags=["Служебное"])
def health():
    return {"status": "ok"}


@app.get("/api/meta", tags=["Служебное"], summary="Справочники для фронта: поля, темы, шкала, уровни")
def meta():
    return {
        "fields": [{"key": f, "label": FIELD_LABELS[f]} for f in CARD_FIELDS],
        "topics": TOPICS,
        "criteria": scoring.CRITERIA,
        "levels": [{"min": b, "key": k, "label": l} for b, k, l in scoring.LEVELS],
    }


@app.get("/api/demo/drafts", tags=["Служебное"], summary="Демо-черновики для кнопки «Заполнить пример»")
def demo_drafts():
    return load_seed()["drafts"]


@app.post("/api/admin/reset", tags=["Служебное"], summary="Сбросить БД к тестовым данным (перед демо)")
def admin_reset(x_admin_token: str = Header("")):
    # На публичном сервере задайте ADMIN_TOKEN — иначе любой сможет стереть базу.
    token = os.getenv("ADMIN_TOKEN", "")
    if token and not secrets.compare_digest(x_admin_token.encode(), token.encode()):
        raise HTTPException(403, "Нужен заголовок X-Admin-Token")
    reset()
    return {"status": "reset"}

