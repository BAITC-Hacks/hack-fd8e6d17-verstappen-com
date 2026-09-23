from fastapi import APIRouter

from app import ai, scoring
from app.crud import validate_fields
from app.drive_checks import inspect_task
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResult,
    BuildCardRequest,
    BuildCardResult,
    ScoreRequest,
    ScoreResult,
    TestDriveRequest,
    TestDriveResult,
)

router = APIRouter(prefix="/api", tags=["ИИ и рейтинг"])


@router.post("/analyze", response_model=AnalyzeResult, summary="Шаг 1–2: черновик → недостающие поля и вопросы")
def analyze(req: AnalyzeRequest):
    return ai.analyze_draft(req.text)


@router.post("/build-card", response_model=BuildCardResult, summary="Шаг 3: ответы → карточка")
def build_card(req: BuildCardRequest):
    return ai.build_card(req.text, req.answers)


@router.post("/score", response_model=ScoreResult, summary="Шаг 4: живой пересчёт рейтинга (без сохранения)")
def score(req: ScoreRequest):
    confirmed = validate_fields(req.confirmed_fields) if req.confirmed_fields is not None else None
    return scoring.score(req.card, confirmed)


@router.post("/test-drive", response_model=TestDriveResult, summary="Проверка реализуемости карточки задачи")
def test_drive(req: TestDriveRequest):
    return inspect_task(req.card)
