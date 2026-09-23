"""Таблицы БД (SQLite через SQLModel)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


class Task(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    topic: str = Field(index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    owner: str = ""
    draft_text: str = ""
    # 10 полей карточки (см. schemas.CARD_FIELDS)
    card: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Баллы начисляются только за подтверждённые человеком поля
    confirmed_fields: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    score: int = Field(default=0, index=True)
    level: str = "draft"
    score_detail: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # [{score, at}] — чтобы показать рост рейтинга на демо
    score_history: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "open"  # open | in_progress | closed
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)


class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    interests: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    skills: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    tech: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    points: int = 0


class Proposal(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="task.id", index=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    idea: str
    plan: str
    deadline: str
    link: str
    status: str = "pending"  # pending | accepted | rejected
    # Число этапов задаётся бизнесом при выборе команды; для старых записей действует максимум.
    milestone_limit: int | None = Field(default=None)
    # Подтверждённые бизнесом этапы: [{note, points, at}]
    milestones: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=now)
    decided_at: datetime | None = None
