from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.crud import RECOMMEND_MIN_SCORE, get_team, proposal_out, task_out, team_out
from app.db import get_session
from app.models import Proposal, Task, Team
from app.schemas import ProposalOut, Recommendation, TeamOut

router = APIRouter(prefix="/api", tags=["Команды"])


@router.get("/teams", response_model=list[TeamOut])
def list_teams(session: Session = Depends(get_session)):
    return [team_out(t) for t in session.exec(select(Team).order_by(Team.id)).all()]


@router.get("/teams/{team_id}", response_model=TeamOut)
def read_team(team_id: int, session: Session = Depends(get_session)):
    return team_out(get_team(session, team_id))


@router.get("/teams/{team_id}/proposals", response_model=list[ProposalOut], summary="Отклики команды и их статусы")
def team_proposals(team_id: int, session: Session = Depends(get_session)):
    get_team(session, team_id)
    rows = session.exec(select(Proposal).where(Proposal.team_id == team_id).order_by(Proposal.created_at.desc())).all()
    return [proposal_out(session, p) for p in rows]


@router.get("/leaderboard", response_model=list[TeamOut], summary="Шаг 8: рейтинг команд по фактическому прогрессу")
def leaderboard(session: Session = Depends(get_session)):
    return [team_out(t) for t in session.exec(select(Team).order_by(Team.points.desc(), Team.name)).all()]


@router.get("/recommendations", response_model=list[Recommendation], summary="Рекомендации задач команде")
def recommendations(team_id: int, limit: int = 5, session: Session = Depends(get_session)):
    """Совпадение навыков/интересов/технологий команды с темой и тегами задачи.
    Только задачи с рейтингом 40+ и статусом «открыта» (ТЗ, раздел 4).
    Каталог при этом не ограничивается. Персональные признаки не используются.
    """
    team = get_team(session, team_id)
    keywords = {k.lower(): k for k in [*team.interests, *team.skills, *team.tech]}
    tasks = session.exec(select(Task).where(Task.status == "open", Task.score >= RECOMMEND_MIN_SCORE)).all()
    result: list[Recommendation] = []
    for t in tasks:
        task_words = {w.lower() for w in [t.topic, *t.tags]}
        matched = [keywords[k] for k in keywords if k in task_words]
        if matched:
            result.append(
                Recommendation(
                    task=task_out(session, t),
                    matched=matched,
                    reason="Совпало: " + ", ".join(matched),
                )
            )
    result.sort(key=lambda r: (-len(r.matched), -r.task.score))
    return result[:limit]
