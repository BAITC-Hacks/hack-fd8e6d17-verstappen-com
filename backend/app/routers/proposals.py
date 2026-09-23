from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.crud import MILESTONE_POINTS, get_task, get_team, proposal_out
from app.db import get_session
from app.models import Proposal, now
from app.schemas import Decision, MilestoneCreate, ProposalOut

router = APIRouter(prefix="/api/proposals", tags=["Отклики и выбор бизнеса"])


def get_proposal(session: Session, proposal_id: int) -> Proposal:
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Отклик не найден")
    return p


@router.post("/{proposal_id}/decision", response_model=ProposalOut, summary="Шаг 7: бизнес вручную выбирает или отклоняет")
def decide(proposal_id: int, body: Decision, session: Session = Depends(get_session)):
    """Только ручное действие бизнеса. Автоматического назначения нет (ТЗ, раздел 3)."""
    p = get_proposal(session, proposal_id)
    if p.status != "pending":
        raise HTTPException(409, "Решение по отклику уже принято")
    task = get_task(session, p.task_id)
    p.status = "accepted" if body.decision == "accept" else "rejected"
    p.decided_at = now()
    # Можно выбрать несколько команд: задача остаётся доступной, пока бизнес её не закроет
    if p.status == "accepted" and task.status == "open":
        task.status = "in_progress"
        session.add(task)
    session.add(p)
    session.commit()
    session.refresh(p)
    return proposal_out(session, p)


@router.post("/{proposal_id}/milestone", response_model=ProposalOut, summary="Шаг 8: бизнес подтверждает этап — команда получает очки")
def confirm_milestone(proposal_id: int, body: MilestoneCreate, session: Session = Depends(get_session)):
    p = get_proposal(session, proposal_id)
    if p.status != "accepted":
        raise HTTPException(409, "Этапы подтверждаются только у выбранной команды")
    note = body.note.strip() or "Этап подтверждён"
    if any(m.get("note", "").strip().casefold() == note.casefold() for m in (p.milestones or [])):
        raise HTTPException(409, "Этот этап уже подтверждён")
    team = get_team(session, p.team_id)
    p.milestones = [*p.milestones, {"note": note, "points": MILESTONE_POINTS, "at": now().isoformat()}]
    team.points += MILESTONE_POINTS
    session.add_all([p, team])
    session.commit()
    session.refresh(p)
    return proposal_out(session, p)
