"""ИИ-модуль: анализ черновика и сборка карточки.

ВЛАДЕЛЕЦ: участник 1. Сейчас здесь только заглушка на правилах (mode="mock"),
чтобы фронт и каталог работали с первой минуты. Сюда подключается LLM:
  1. вызвать модель с JSON-выводом;
  2. провалидировать ответ через AnalyzeResult / BuildCardResult;
  3. при ошибке — один повтор, затем fallback на функции ниже.
Главное правило: у каждого заполненного поля должен быть источник (цитата
из текста пользователя), иначе поле обнуляется — ИИ не добавляет фактов.
"""
import re

from app import scoring
from app.schemas import (
    CARD_FIELDS,
    AnalyzeResult,
    Answer,
    BuildCardResult,
    Question,
    TaskCard,
)

QUESTION_TEMPLATES: dict[str, str] = {
    "context": "Что происходит сейчас? Опишите текущий процесс и в чём проблема.",
    "need": "Что именно нужно изменить или получить в итоге?",
    "users": "Для кого создаётся решение: кто будет им пользоваться?",
    "data": "Какие данные, примеры или материалы вы можете дать команде?",
    "constraints": "Какие есть ограничения: сроки, технологии, доступы?",
    "expected_result": "Какой конкретный результат вы ждёте от команды (прототип, модель, отчёт)?",
    "success_criteria": "По каким измеримым признакам вы поймёте, что решение подходит?",
    "contact": "Как с вами связаться: email, телефон или Telegram?",
    "interaction_format": "Как часто и в каком формате вы готовы консультировать команду?",
    "title": "Как коротко назвать задачу?",
}


def _title_from(text: str) -> str:
    first = re.split(r"[.!?\n]", text.strip(), maxsplit=1)[0]
    return first[:80].strip()


def _questions(card: TaskCard, confirmed: list[str]) -> list[Question]:
    result = scoring.score(card, confirmed)
    gains = {h.field: h.gain for h in result.hints}
    fields = sorted(
        (f for f in CARD_FIELDS if f != "title" and gains.get(f, 0) > 0),
        key=lambda f: gains[f],
        reverse=True,
    )
    return [Question(field=f, text=QUESTION_TEMPLATES[f], points=gains[f]) for f in fields]


def analyze_draft(text: str) -> AnalyzeResult:
    # Заглушка: весь черновик — это «контекст», название — первое предложение.
    card = TaskCard(title=_title_from(text), context=text)
    sources = {"title": card.title, "context": text}
    filled = [f for f in CARD_FIELDS if getattr(card, f)]
    questions = _questions(card, filled)
    return AnalyzeResult(
        card=card,
        sources=sources,
        missing_fields=[f for f in CARD_FIELDS if not getattr(card, f)],
        questions=questions,
        score=scoring.score(card, filled),
        mode="mock",
    )


def build_card(text: str, answers: list[Answer]) -> BuildCardResult:
    base = analyze_draft(text)
    data = base.card.model_dump()
    sources = dict(base.sources)
    for a in answers:
        if a.field in CARD_FIELDS and a.answer.strip():
            data[a.field] = a.answer.strip()
            sources[a.field] = a.answer.strip()
    card = TaskCard(**data)
    filled = [f for f in CARD_FIELDS if getattr(card, f)]
    return BuildCardResult(card=card, sources=sources, score=scoring.score(card, filled), mode="mock")
