"""Общая логика: пересчёт рейтинга, сериализация, правила каталога."""
from fastapi import HTTPException
from sqlmodel import Session, func, select

from app import scoring
from app.models import Proposal, Task, Team, now
from app.schemas import (
    CARD_FIELDS,
    ProposalOut,
    ScoreResult,
    TaskCard,
    TaskOut,
    TeamOut,
)

RECOMMEND_MIN_SCORE = 40  # ТЗ: рекомендовать можно только с уровня «рабочая»


def validate_fields(fields: list[str]) -> list[str]:
    unknown = set(fields) - set(CARD_FIELDS)
    if unknown:
        raise HTTPException(422, f"Неизвестные поля карточки: {sorted(unknown)}")
    return list(dict.fromkeys(fields))


def rescore(task: Task) -> None:
    """Пересчитать рейтинг и дописать историю, если балл изменился."""
    result = scoring.score(TaskCard(**task.card), task.confirmed_fields)
    changed = result.total != task.score or not task.score_history
    task.score = result.total
    task.level = result.level
    task.score_detail = result.model_dump()
    if changed:
        task.score_history = [*task.score_history, {"score": result.total, "at": now().isoformat()}]
    task.updated_at = now()


def get_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Задача не найдена")
    return task


def get_team(session: Session, team_id: int) -> Team:
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Команда не найдена")
    return team


def proposals_count(session: Session, task_id: int) -> int:
    return session.exec(select(func.count()).select_from(Proposal).where(Proposal.task_id == task_id)).one()


def task_out(session: Session, task: Task, count: int | None = None) -> TaskOut:
    detail = ScoreResult(**task.score_detail)
    return TaskOut(
        id=task.id,
        title=task.title,
        topic=task.topic,
        tags=task.tags,
        owner=task.owner,
        draft_text=task.draft_text,
        card=TaskCard(**task.card),
        confirmed_fields=task.confirmed_fields,
        score=task.score,
        level=task.level,
        level_label=detail.level_label,
        needs_clarification=task.level == "draft",
        recommendable=task.score >= RECOMMEND_MIN_SCORE and task.status == "open",
        score_detail=detail,
        score_history=task.score_history,
        status=task.status,
        proposals_count=proposals_count(session, task.id) if count is None else count,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def team_out(team: Team) -> TeamOut:
    return TeamOut.model_validate(team, from_attributes=True)


def proposal_out(session: Session, p: Proposal) -> ProposalOut:
    task = session.get(Task, p.task_id)
    return ProposalOut(
        id=p.id,
        task_id=p.task_id,
        task_title=task.title if task else "",
        team=team_out(session.get(Team, p.team_id)),
        idea=p.idea,
        plan=p.plan,
        deadline=p.deadline,
        link=p.link,
        status=p.status,
        milestone_limit=p.milestone_limit,
        milestones=p.milestones,
        created_at=p.created_at,
        decided_at=p.decided_at,
    )


def catalog_sort_key(t: TaskOut):
    """Правила каталога:
    1) закрытые задачи — в конце;
    2) выше рейтинг — выше позиция;
    3) при равном рейтинге — более свежие задачи;
    4) затем меньше откликов (даём шанс задачам без внимания).
    """
    return (t.status == "closed", -t.score, -t.created_at.timestamp(), t.proposals_count)
