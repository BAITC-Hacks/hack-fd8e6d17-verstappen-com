"""Синтетические данные (ТЗ, раздел 6). Запуск вручную: python -m app.seed --reset"""
import json
import sys
from pathlib import Path

from sqlmodel import Session, select

from app.crud import MILESTONE_POINTS, rescore
from app.db import drop_db, engine, init_db
from app.models import Proposal, Task, Team, now
from app.schemas import CARD_FIELDS

SEED_FILE = Path(__file__).with_name("seed_data.json")


def load_seed() -> dict:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def seed(session: Session) -> None:
    data = load_seed()

    tasks: list[Task] = []
    for item in data["tasks"]:
        card = {f: item["card"].get(f, "") for f in CARD_FIELDS}
        task = Task(
            title=card["title"],
            topic=item["topic"],
            tags=item["tags"],
            owner=item["owner"],
            draft_text=item["draft_text"],
            card=card,
            confirmed_fields=[f for f, v in card.items() if v],
        )
        rescore(task)
        session.add(task)
        tasks.append(task)

    teams = [Team(**t) for t in data["teams"]]
    session.add_all(teams)
    session.flush()

    for p in data["proposals"]:
        task, team = tasks[p["task_index"]], teams[p["team_index"]]
        milestones = [
            {"note": f"Этап {i + 1} подтверждён", "points": MILESTONE_POINTS, "at": now().isoformat()}
            for i in range(p.get("milestones", 0))
        ]
        team.points += MILESTONE_POINTS * len(milestones)
        session.add(
            Proposal(
                task_id=task.id,
                team_id=team.id,
                idea=p["idea"],
                plan=p["plan"],
                deadline=p["deadline"],
                link=p["link"],
                status=p["status"],
                milestones=milestones,
                decided_at=now() if p["status"] != "pending" else None,
            )
        )
        if p["status"] == "accepted":
            task.status = "in_progress"
    session.commit()


def seed_if_empty() -> None:
    init_db()
    with Session(engine) as session:
        if session.exec(select(Task)).first() is None:
            seed(session)


def reset() -> None:
    drop_db()
    init_db()
    with Session(engine) as session:
        seed(session)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset()
        print("БД пересоздана и заполнена тестовыми данными")
    else:
        seed_if_empty()
        print("Готово")
