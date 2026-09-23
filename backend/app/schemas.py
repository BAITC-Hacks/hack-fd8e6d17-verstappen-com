"""Контракт API (Pydantic). Фронт повторяет эти типы в TypeScript."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.constants import MAX_MILESTONES

# 10 полей карточки по ТЗ (раздел 3)
CARD_FIELDS: list[str] = [
    "title",
    "context",
    "need",
    "users",
    "data",
    "constraints",
    "expected_result",
    "success_criteria",
    "contact",
    "interaction_format",
]

FIELD_LABELS: dict[str, str] = {
    "title": "Название",
    "context": "Контекст",
    "need": "Потребность",
    "users": "Пользователи",
    "data": "Данные и материалы",
    "constraints": "Ограничения",
    "expected_result": "Ожидаемый результат",
    "success_criteria": "Критерии успеха",
    "contact": "Контакт",
    "interaction_format": "Формат взаимодействия",
}

TOPICS: list[str] = [
    "Ритейл",
    "Финтех",
    "Образование",
    "Логистика",
    "HoReCa",
    "Медицина",
    "Госсектор",
    "Агро",
    "Другое",
]

Level = Literal["draft", "working", "ready", "priority"]
TaskStatus = Literal["open", "in_progress", "closed"]


class TaskCard(BaseModel):
    title: str = Field("", max_length=200)
    context: str = Field("", max_length=4000)
    need: str = Field("", max_length=4000)
    users: str = Field("", max_length=2000)
    data: str = Field("", max_length=4000)
    constraints: str = Field("", max_length=2000)
    expected_result: str = Field("", max_length=4000)
    success_criteria: str = Field("", max_length=2000)
    contact: str = Field("", max_length=300)
    interaction_format: str = Field("", max_length=1000)

    @field_validator("*", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v


# ---------- Рейтинг ----------

class CriterionScore(BaseModel):
    key: str
    label: str
    weight: int
    points: int
    fields: list[str]
    reason: str


class Hint(BaseModel):
    field: str
    label: str
    gain: int
    text: str


class ScoreResult(BaseModel):
    total: int
    level: Level
    level_label: str
    breakdown: list[CriterionScore]
    hints: list[Hint]  # отсортированы по убыванию gain
    missing_fields: list[str]
    next_level_at: int | None  # порог следующего уровня, None если уже 90+


class ScoreRequest(BaseModel):
    card: TaskCard
    confirmed_fields: list[str] | None = None  # None = считать все поля


class TestDriveRequest(BaseModel):
    card: TaskCard


class TestDriveFinding(BaseModel):
    key: str
    field: str
    title: str
    detail: str
    suggestion: str
    severity: Literal["high", "medium", "low"]


class TestDriveResult(BaseModel):
    findings: list[TestDriveFinding]
    passed: bool


# ---------- ИИ ----------

class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=10, max_length=5000)


class Question(BaseModel):
    field: str
    text: str
    points: int  # сколько баллов даст полный ответ


class AnalyzeResult(BaseModel):
    card: TaskCard
    sources: dict[str, str]  # поле -> цитата из текста пользователя
    missing_fields: list[str]
    questions: list[Question] = Field(min_length=3)
    score: ScoreResult
    mode: Literal["llm", "mock"]


class Answer(BaseModel):
    field: str
    answer: str = Field(max_length=4000)


class BuildCardRequest(BaseModel):
    text: str = Field(min_length=10, max_length=5000)
    answers: list[Answer] = []


class BuildCardResult(BaseModel):
    card: TaskCard
    sources: dict[str, str]
    score: ScoreResult
    mode: Literal["llm", "mock"]


# ---------- Задачи ----------

class TaskCreate(BaseModel):
    card: TaskCard
    topic: str = "Другое"
    tags: list[str] = []
    owner: str = Field("", max_length=200)
    draft_text: str = Field("", max_length=5000)
    confirmed_fields: list[str] = Field(min_length=1)


class TaskUpdate(BaseModel):
    card: dict[str, str] | None = None  # частичное обновление полей карточки
    topic: str | None = None
    tags: list[str] | None = None
    confirmed_fields: list[str] | None = None
    status: TaskStatus | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    topic: str
    tags: list[str]
    owner: str
    draft_text: str
    card: TaskCard
    confirmed_fields: list[str]
    score: int
    level: Level
    level_label: str
    needs_clarification: bool  # уровень «черновик»
    recommendable: bool  # 40+ баллов и задача открыта
    score_detail: ScoreResult
    score_history: list[dict]
    status: TaskStatus
    proposals_count: int
    created_at: datetime
    updated_at: datetime


# ---------- Команды и отклики ----------

class TeamOut(BaseModel):
    id: int
    name: str
    interests: list[str]
    skills: list[str]
    tech: list[str]
    points: int


class ProposalCreate(BaseModel):
    team_id: int
    idea: str = Field(min_length=10, max_length=4000)
    plan: str = Field(min_length=10, max_length=4000)
    deadline: str = Field(min_length=2, max_length=100)
    link: HttpUrl


class ProposalOut(BaseModel):
    id: int
    task_id: int
    task_title: str
    team: TeamOut
    idea: str
    plan: str
    deadline: str
    link: str
    status: Literal["pending", "accepted", "rejected"]
    milestone_limit: int | None
    milestones: list[dict]
    created_at: datetime
    decided_at: datetime | None


class Decision(BaseModel):
    decision: Literal["accept", "reject"]
    milestone_count: int | None = Field(
        default=None,
        ge=1,
        le=MAX_MILESTONES,
        description="Обязательное число этапов при выборе команды: от 1 до 10.",
    )

    @model_validator(mode="after")
    def require_milestone_count_when_accepting(self):
        if self.decision == "accept" and self.milestone_count is None:
            raise ValueError("При выборе команды укажите число этапов от 1 до 10")
        return self


class MilestoneCreate(BaseModel):
    note: str = Field("Этап подтверждён", max_length=500)


class Recommendation(BaseModel):
    task: TaskOut
    matched: list[str]
    reason: str
