"""Рейтинг готовности задачи 0–100.

ВЛАДЕЛЕЦ: участник 1. Это базовая версия на правилах — сигнатуру
`score(card, confirmed_fields)` и формат ScoreResult не менять, остальным
частям системы важен только он.
"""
import re

from app.schemas import FIELD_LABELS, CriterionScore, Hint, ScoreResult, TaskCard

# Шкала из ТЗ (раздел 4). Поле карточки -> показатель рейтинга.
# «Название» в рейтинге не участвует (в ТЗ за него баллов нет).
CRITERIA: list[dict] = [
    {"key": "context_need", "label": "Контекст и потребность", "weight": 20, "fields": ["context", "need"]},
    {"key": "data", "label": "Данные и материалы", "weight": 20, "fields": ["data"]},
    {"key": "expected_result", "label": "Ожидаемый результат", "weight": 15, "fields": ["expected_result"]},
    {"key": "success_criteria", "label": "Критерии успеха", "weight": 15, "fields": ["success_criteria"]},
    {"key": "constraints", "label": "Ограничения", "weight": 10, "fields": ["constraints"]},
    {"key": "users", "label": "Пользователи", "weight": 10, "fields": ["users"]},
    {"key": "business_link", "label": "Связь с бизнесом", "weight": 10, "fields": ["contact", "interaction_format"]},
]

# (нижняя граница, код, название)
LEVELS: list[tuple[int, str, str]] = [
    (90, "priority", "Приоритетная"),
    (70, "ready", "Готовая"),
    (40, "working", "Рабочая"),
    (0, "draft", "Черновик"),
]

MIN_LEN = 15  # короче — считается «слишком кратко», половина баллов

HAS_NUMBER = re.compile(r"\d")
HAS_CONTACT = re.compile(r"@|\+?\d[\d\s()-]{8,}|t\.me/")


def level_for(total: int) -> tuple[str, str]:
    for bound, code, label in LEVELS:
        if total >= bound:
            return code, label
    return "draft", "Черновик"


def next_level_at(total: int) -> int | None:
    higher = [bound for bound, _, _ in LEVELS if bound > total]
    return min(higher) if higher else None


def field_max_points(field: str) -> int:
    """Сколько баллов максимум приносит одно поле (для «+N баллов» у вопросов)."""
    for c in CRITERIA:
        if field in c["fields"]:
            return round(c["weight"] / len(c["fields"]))
    return 0


def _field_quality(field: str, value: str) -> tuple[float, str | None]:
    """Доля баллов поля 0..1 и подсказка, если не максимум."""
    if not value:
        return 0.0, f"Заполните поле «{FIELD_LABELS[field]}»"
    if len(value) < MIN_LEN:
        return 0.5, f"«{FIELD_LABELS[field]}»: слишком кратко, раскройте подробнее"
    if field == "success_criteria" and not HAS_NUMBER.search(value):
        return 0.6, "Добавьте измеримый порог в критерии успеха (число, %, срок)"
    if field == "constraints" and not HAS_NUMBER.search(value):
        return 0.7, "Укажите в ограничениях конкретный срок или объём"
    if field == "contact" and not HAS_CONTACT.search(value):
        return 0.5, "Укажите контакт: email, телефон или Telegram"
    return 1.0, None


def score(card: TaskCard, confirmed_fields: list[str] | None = None) -> ScoreResult:
    values = card.model_dump()
    if confirmed_fields is not None:
        confirmed = set(confirmed_fields)
        values = {k: (v if k in confirmed else "") for k, v in values.items()}

    breakdown: list[CriterionScore] = []
    hints: list[Hint] = []
    missing: list[str] = []

    for c in CRITERIA:
        share = c["weight"] / len(c["fields"])
        points = 0.0
        reasons: list[str] = []
        for f in c["fields"]:
            q, hint = _field_quality(f, values.get(f, ""))
            points += share * q
            if not values.get(f):
                missing.append(f)
            if hint:
                reasons.append(hint)
                hints.append(Hint(field=f, label=FIELD_LABELS[f], gain=round(share * (1 - q)), text=hint))
        breakdown.append(
            CriterionScore(
                key=c["key"],
                label=c["label"],
                weight=c["weight"],
                points=round(points),
                fields=c["fields"],
                reason="; ".join(reasons) if reasons else "Заполнено полностью",
            )
        )

    total = min(100, sum(b.points for b in breakdown))
    code, label = level_for(total)
    hints.sort(key=lambda h: h.gain, reverse=True)
    return ScoreResult(
        total=total,
        level=code,
        level_label=label,
        breakdown=breakdown,
        hints=hints,
        missing_fields=missing,
        next_level_at=next_level_at(total),
    )
