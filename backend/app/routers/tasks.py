from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.crud import (
    catalog_sort_key,
    get_task,
    get_team,
    proposal_out,
    rescore,
    task_out,
    validate_fields,
)
from app.db import get_session
from app.models import Proposal, Task, now
from app.schemas import (
    TOPICS,
    ProposalCreate,
    ProposalOut,
    TaskCard,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

router = APIRouter(prefix="/api", tags=["Задачи и каталог"])


@router.post("/tasks", response_model=TaskOut, status_code=201, summary="Шаг 5: публикация подтверждённой карточки")
def create_task(body: TaskCreate, session: Session = Depends(get_session)):
    if not body.card.title:
        raise HTTPException(422, "У задачи должно быть название")
    if body.topic not in TOPICS:
        raise HTTPException(422, f"Неизвестная тема. Допустимые: {TOPICS}")
    task = Task(
        title=body.card.title,
        topic=body.topic,
        tags=[t.strip() for t in body.tags if t.strip()],
        owner=body.owner,
        draft_text=body.draft_text,
        card=body.card.model_dump(),
        confirmed_fields=validate_fields(body.confirmed_fields),
    )
    rescore(task)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task_out(session, task, 0)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def read_task(task_id: int, session: Session = Depends(get_session)):
    return task_out(session, get_task(session, task_id))


@router.patch("/tasks/{task_id}", response_model=TaskOut, summary="Правка карточки → пересчёт рейтинга и позиции")
def update_task(task_id: int, body: TaskUpdate, session: Session = Depends(get_session)):
    task = get_task(session, task_id)
    if body.card is not None:
        merged = {**task.card, **body.card}
        task.card = TaskCard(**merged).model_dump()  # валидация полей и длин
        task.title = task.card["title"] or task.title
    if body.topic is not None:
        if body.topic not in TOPICS:
            raise HTTPException(422, f"Неизвестная тема. Допустимые: {TOPICS}")
        task.topic = body.topic
    if body.tags is not None:
        task.tags = [t.strip() for t in body.tags if t.strip()]
    if body.confirmed_fields is not None:
        task.confirmed_fields = validate_fields(body.confirmed_fields)
    elif body.card is not None:
        # Правка человеком = подтверждение изменённых полей
        task.confirmed_fields = validate_fields([*task.confirmed_fields, *body.card.keys()])
    if body.status is not None:
        task.status = body.status
    rescore(task)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task_out(session, task)


@router.post("/tasks/{task_id}/close", response_model=TaskOut, summary="Закрыть задачу (в том числе без выбора команды)")
def close_task(task_id: int, session: Session = Depends(get_session)):
    task = get_task(session, task_id)
    task.status = "closed"
    task.updated_at = now()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task_out(session, task)


@router.get("/catalog", response_model=list[TaskOut], summary="Общий каталог: все задачи, сортировка по рейтингу")
def catalog(
    topic: str | None = None,
    level: Literal["draft", "working", "ready", "priority"] | None = None,
    status: Literal["open", "in_progress", "closed"] | None = None,
    q: str | None = None,
    owner: str | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Task)
    if topic:
        stmt = stmt.where(Task.topic == topic)
    if level:
        stmt = stmt.where(Task.level == level)
    if status:
        stmt = stmt.where(Task.status == status)
    if owner:
        stmt = stmt.where(Task.owner == owner)
    tasks = session.exec(stmt).all()
    if q:
        ql = q.lower()
        tasks = [t for t in tasks if ql in t.title.lower() or ql in " ".join(t.card.values()).lower()]
    items = [task_out(session, t) for t in tasks]
    return sorted(items, key=catalog_sort_key)


@router.get("/tasks/{task_id}/proposals", response_model=list[ProposalOut], summary="Шаг 7: отклики на задачу")
def list_proposals(task_id: int, session: Session = Depends(get_session)):
    get_task(session, task_id)
    rows = session.exec(select(Proposal).where(Proposal.task_id == task_id).order_by(Proposal.created_at)).all()
    return [proposal_out(session, p) for p in rows]


@router.post("/tasks/{task_id}/proposals", response_model=ProposalOut, status_code=201, summary="Шаг 6: отклик команды")
def create_proposal(task_id: int, body: ProposalCreate, session: Session = Depends(get_session)):
    task = get_task(session, task_id)
    get_team(session, body.team_id)
    if task.status == "closed":
        raise HTTPException(409, "Задача закрыта, отклики не принимаются")
    # Низкий рейтинг НЕ запрещает отклик (ТЗ, раздел 4); число откликов не ограничено.
    p = Proposal(
        task_id=task_id,
        team_id=body.team_id,
        idea=body.idea,
        plan=body.plan,
        deadline=body.deadline,
        link=str(body.link),
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return proposal_out(session, p)
