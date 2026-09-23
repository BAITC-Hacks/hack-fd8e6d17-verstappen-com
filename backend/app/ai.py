"""AI draft analysis and card building with a grounded rules fallback."""
import os
import re

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, ValidationError

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

MAX_MODEL_ATTEMPTS = 3


class SourceQuotes(BaseModel):
    """Fixed-key source object is compatible with strict Structured Outputs."""

    model_config = ConfigDict(extra="forbid")

    title: str = ""
    context: str = ""
    need: str = ""
    users: str = ""
    data: str = ""
    constraints: str = ""
    expected_result: str = ""
    success_criteria: str = ""
    contact: str = ""
    interaction_format: str = ""


class GroundedExtraction(BaseModel):
    """Strict structured output from the model: values must be grounded by quotes."""

    model_config = ConfigDict(extra="forbid")

    card: TaskCard
    sources: SourceQuotes


def _client() -> OpenAI | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    return OpenAI(api_key=key)


def _extract_with_openai(text: str, answers: list[Answer] | None = None) -> GroundedExtraction:
    client = _client()
    if client is None:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    answer_lines = "\n".join(
        f"- {a.field}: {a.answer}" for a in (answers or []) if a.field in CARD_FIELDS
    ) or "Нет дополнительных ответов."
    source_context = (
        f"Исходное описание бизнеса:\n{text}\n\n"
        f"Дополнительные ответы пользователя (это тоже допустимые источники):\n{answer_lines}"
    )
    system_prompt = (
        "Извлеки данные для карточки бизнес-задачи из предоставленного текста. "
        "Заполни все 10 полей схемы. Не додумывай и не обобщай факты, которых нет "
        "в источниках. Для каждого непустого поля sources должен содержать точную "
        "непрерывную цитату из исходного описания или соответствующего ответа. "
        "Если данных недостаточно, оставь поле пустым и не указывай цитату. "
        "Название также должно опираться на точную цитату."
    )
    last_error: Exception | None = None
    for attempt in range(MAX_MODEL_ATTEMPTS):
        try:
            response = client.beta.chat.completions.parse(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": source_context},
                ],
                response_format=GroundedExtraction,
                temperature=0,
            )
            parsed = response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("Model returned no structured result")
            # Re-validate even though the SDK parsed against the Pydantic schema.
            return GroundedExtraction.model_validate(parsed.model_dump())
        except (ValidationError, ValueError, TypeError) as exc:
            last_error = exc
        except Exception as exc:
            # API/network errors also get the bounded retry, then callers use mock.
            last_error = exc
        if attempt + 1 < MAX_MODEL_ATTEMPTS:
            continue
    raise RuntimeError("OpenAI extraction failed after retries") from last_error


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
    questions = [Question(field=f, text=QUESTION_TEMPLATES[f], points=gains[f]) for f in fields]
    # The API contract requires at least three questions even if the extracted card is full.
    fallback_fields = [f for f in CARD_FIELDS if f != "title" and f not in {q.field for q in questions}]
    for field in fallback_fields:
        if len(questions) >= 3:
            break
        questions.append(Question(field=field, text=QUESTION_TEMPLATES[field], points=max(1, scoring.field_max_points(field))))
    return questions


def _ground_sources(
    extraction: GroundedExtraction,
    text: str,
    answers: list[Answer] | None = None,
) -> tuple[TaskCard, dict[str, str]]:
    """Keep populated fields only when their exact source quote is user-provided."""
    answer_sources = {a.field: a.answer.strip() for a in (answers or []) if a.field in CARD_FIELDS and a.answer.strip()}
    card_values = extraction.card.model_dump()
    source_values = extraction.sources.model_dump()
    grounded: dict[str, str] = {}
    for field in CARD_FIELDS:
        value = card_values[field].strip()
        quote = source_values[field].strip()
        allowed = text if quote and quote in text else ""
        if not allowed and quote and field in answer_sources and quote in answer_sources[field]:
            allowed = answer_sources[field]
        if not value or not quote or not allowed:
            card_values[field] = ""
            continue
        grounded[field] = quote
    return TaskCard(**card_values), grounded


def _mock_extraction(text: str, answers: list[Answer] | None = None) -> GroundedExtraction:
    card = TaskCard(title=_title_from(text), context=text)
    sources = {"title": card.title, "context": text}
    for answer in answers or []:
        if answer.field in CARD_FIELDS and answer.answer.strip():
            setattr(card, answer.field, answer.answer.strip())
            sources[answer.field] = answer.answer.strip()
    return GroundedExtraction(card=card, sources=SourceQuotes(**sources))


def _extract(text: str, answers: list[Answer] | None = None) -> tuple[GroundedExtraction, str]:
    if os.getenv("OPENAI_API_KEY", "").strip():
        try:
            return _extract_with_openai(text, answers), "llm"
        except Exception:
            # The API stays available when the provider is down or returns invalid data.
            pass
    return _mock_extraction(text, answers), "mock"


def analyze_draft(text: str) -> AnalyzeResult:
    extraction, mode = _extract(text)
    card, sources = _ground_sources(extraction, text)
    filled = [f for f in CARD_FIELDS if getattr(card, f)]
    return AnalyzeResult(
        card=card,
        sources=sources,
        missing_fields=[f for f in CARD_FIELDS if not getattr(card, f)],
        questions=_questions(card, filled),
        score=scoring.score(card, filled),
        mode=mode,
    )


def build_card(text: str, answers: list[Answer]) -> BuildCardResult:
    extraction, mode = _extract(text, answers)
    card, sources = _ground_sources(extraction, text, answers)
    filled = [f for f in CARD_FIELDS if getattr(card, f)]
    return BuildCardResult(card=card, sources=sources, score=scoring.score(card, filled), mode=mode)
