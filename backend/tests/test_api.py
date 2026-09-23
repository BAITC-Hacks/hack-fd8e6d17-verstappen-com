"""Тестовые сценарии из ТЗ: сквозной путь и правила каталога."""

WEAK_DRAFT = "У нас сеть кофеен, много списаний выпечки. Хотим что-то с этим сделать."


def publish(client, card, **extra):
    body = {"card": card, "topic": "Ритейл", "tags": ["ML", "Python"], "owner": "Тест", "confirmed_fields": [k for k, v in card.items() if v]}
    body.update(extra)
    return client.post("/api/tasks", json=body)


def test_end_to_end(client):
    # 1–2. Черновик → минимум 3 вопроса с ценой в баллах
    r = client.post("/api/analyze", json={"text": WEAK_DRAFT})
    assert r.status_code == 200
    analysis = r.json()
    assert len(analysis["questions"]) >= 3
    assert all(q["points"] > 0 for q in analysis["questions"])
    weak_score = analysis["score"]["total"]

    # 3. Ответы → карточка, у каждого поля есть источник
    answers = [
        {"field": "need", "answer": "Сократить списания выпечки и нехватку популярных позиций."},
        {"field": "data", "answer": "Чеки за 2 года в CSV и журнал списаний."},
        {"field": "success_criteria", "answer": "Списания снижаются на 20% за 4 недели."},
        {"field": "contact", "answer": "test@coffee.kz"},
    ]
    r = client.post("/api/build-card", json={"text": WEAK_DRAFT, "answers": answers})
    built = r.json()
    card = built["card"]
    for f, v in card.items():
        if v:
            assert f in built["sources"], f"поле {f} без источника"

    # 4. Рейтинг вырос
    assert built["score"]["total"] > weak_score

    # 5. Публикация и позиция в каталоге
    r = publish(client, card)
    assert r.status_code == 201
    task = r.json()
    assert task["score"] == built["score"]["total"]

    # 6. Команда откликается сама
    r = client.post(
        f"/api/tasks/{task['id']}/proposals",
        json={"team_id": 1, "idea": "Модель прогноза спроса", "plan": "Две недели на прототип", "deadline": "4 недели", "link": "https://github.com/x/y"},
    )
    assert r.status_code == 201
    proposal = r.json()
    assert proposal["status"] == "pending"  # никакого автоназначения

    # 7. Бизнес вручную выбирает
    r = client.post(f"/api/proposals/{proposal['id']}/decision", json={"decision": "accept", "milestone_count": 2})
    assert r.json()["status"] == "accepted"
    assert r.json()["milestone_limit"] == 2
    assert client.get(f"/api/tasks/{task['id']}").json()["status"] == "in_progress"

    # 8. Подтверждённый этап → очки команде
    before = client.get("/api/teams/1").json()["points"]
    r = client.post(f"/api/proposals/{proposal['id']}/milestone", json={"note": "Прототип сдан"})
    assert r.status_code == 200
    assert client.get("/api/teams/1").json()["points"] > before


def test_edit_recalculates_score_and_position(client):
    card = {"title": "Тестовая задача", "context": "Короткий контекст задачи для проверки."}
    task = publish(client, card).json()
    catalog = client.get("/api/catalog").json()
    pos_before = [t["id"] for t in catalog].index(task["id"])

    r = client.patch(
        f"/api/tasks/{task['id']}",
        json={"card": {
            "need": "Нужно сократить ручную работу операторов вдвое.",
            "data": "Выгрузка 10 000 обращений за год в CSV.",
            "expected_result": "Прототип сервиса классификации с веб-интерфейсом.",
            "success_criteria": "Точность не ниже 85% на отложенной выборке.",
            "users": "Операторы первой линии поддержки.",
        }},
    )
    updated = r.json()
    assert updated["score"] > task["score"]
    assert len(updated["score_history"]) == 2

    catalog = client.get("/api/catalog").json()
    assert [t["id"] for t in catalog].index(task["id"]) < pos_before


def test_only_confirmed_fields_score(client):
    card = {"title": "T", "context": "Подробный контекст задачи для рейтинга.", "data": "Большой датасет с примерами за год."}
    full = client.post("/api/score", json={"card": card}).json()["total"]
    partial = client.post("/api/score", json={"card": card, "confirmed_fields": ["title", "context"]}).json()["total"]
    assert partial < full


def test_catalog_shows_low_score_and_sorted(client):
    catalog = client.get("/api/catalog").json()
    assert len(catalog) == 8
    assert any(t["needs_clarification"] for t in catalog)  # черновики не скрываются
    open_scores = [t["score"] for t in catalog if t["status"] != "closed"]
    assert open_scores == sorted(open_scores, reverse=True)


def test_low_score_task_accepts_proposals_but_not_recommended(client):
    draft = next(t for t in client.get("/api/catalog").json() if t["level"] == "draft")
    r = client.post(
        f"/api/tasks/{draft['id']}/proposals",
        json={"team_id": 5, "idea": "Анализ снимков Sentinel-2", "plan": "Прототип за три недели", "deadline": "3 недели", "link": "https://example.com"},
    )
    assert r.status_code == 201
    for team in client.get("/api/teams").json():
        recs = client.get("/api/recommendations", params={"team_id": team["id"]}).json()
        assert all(rec["task"]["score"] >= 40 for rec in recs)


def test_recommendations_explain_match(client):
    recs = client.get("/api/recommendations", params={"team_id": 1}).json()
    assert recs and recs[0]["matched"]


def test_validation_errors(client):
    assert client.post("/api/analyze", json={"text": "коротко"}).status_code == 422
    r = client.post("/api/tasks/1/proposals", json={"team_id": 1, "idea": "Хорошая идея решения", "plan": "План из нескольких шагов", "deadline": "2 недели", "link": "не ссылка"})
    assert r.status_code == 422
    assert publish(client, {"title": "X", "context": "Контекст достаточной длины"}, confirmed_fields=["oops"]).status_code == 422


def test_decision_is_final_and_closed_task_rejects_proposals(client):
    p = client.get("/api/tasks/1/proposals").json()[0]
    assert client.post(f"/api/proposals/{p['id']}/decision", json={"decision": "reject"}).status_code == 200
    assert client.post(f"/api/proposals/{p['id']}/decision", json={"decision": "accept", "milestone_count": 3}).status_code == 409
    client.post("/api/tasks/1/close")
    r = client.post("/api/tasks/1/proposals", json={"team_id": 2, "idea": "Идея решения задачи", "plan": "План работы команды", "deadline": "1 неделя", "link": "https://a.b"})
    assert r.status_code == 409


def test_business_can_set_a_milestone_count_for_each_accepted_proposal(client):
    task = publish(client, {"title": "Тест этапов", "context": "Контекст задачи для проверки ограничения этапов."}).json()
    proposal = client.post(
        f"/api/tasks/{task['id']}/proposals",
        json={"team_id": 1, "idea": "Реализуем решение задачи", "plan": "Сделаем прототип и проверим", "deadline": "3 недели", "link": "https://github.com/x/y"},
    ).json()
    accepted = client.post(
        f"/api/proposals/{proposal['id']}/decision",
        json={"decision": "accept", "milestone_count": 2},
    )
    assert accepted.status_code == 200
    assert accepted.json()["milestone_limit"] == 2

    points_before = client.get("/api/teams/1").json()["points"]
    for number in range(1, 3):
        response = client.post(f"/api/proposals/{proposal['id']}/milestone", json={"note": f"Этап {number} завершён"})
        assert response.status_code == 200
        assert len(response.json()["milestones"]) == number

    rejected = client.post(f"/api/proposals/{proposal['id']}/milestone", json={"note": "Третий этап завершён"})
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "Достигнут лимит этапов: 2"
    assert client.get("/api/teams/1").json()["points"] == points_before + 40


def test_milestone_count_has_a_hard_cap_of_ten(client):
    proposal = client.get("/api/tasks/1/proposals").json()[0]
    invalid = client.post(
        f"/api/proposals/{proposal['id']}/decision",
        json={"decision": "accept", "milestone_count": 11},
    )
    assert invalid.status_code == 422
    assert proposal["status"] == "pending"

    accepted = client.post(
        f"/api/proposals/{proposal['id']}/decision",
        json={"decision": "accept", "milestone_count": 10},
    )
    assert accepted.status_code == 200
    assert accepted.json()["milestone_limit"] == 10
    for number in range(1, 11):
        response = client.post(f"/api/proposals/{proposal['id']}/milestone", json={"note": f"Этап {number} завершён"})
        assert response.status_code == 200
    rejected = client.post(f"/api/proposals/{proposal['id']}/milestone", json={"note": "Этап 11 завершён"})
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "Достигнут лимит этапов: 10"


def test_accepting_a_proposal_requires_a_milestone_count(client):
    proposal = client.get("/api/tasks/1/proposals").json()[0]
    response = client.post(f"/api/proposals/{proposal['id']}/decision", json={"decision": "accept"})
    assert response.status_code == 422
    assert client.get("/api/tasks/1/proposals").json()[0]["status"] == "pending"


def test_grounding_keeps_title_and_context_from_draft():
    """Если LLM не заполнила название/контекст, они берутся из черновика — задачу можно опубликовать."""
    from app.ai import GroundedExtraction, SourceQuotes, _ground_sources
    from app.schemas import TaskCard

    draft = "Курьеры тратят много времени на маршруты. Хотим автоматизировать."
    extraction = GroundedExtraction(card=TaskCard(need="Внедрить дроны"), sources=SourceQuotes(need="внедрить дроны"))
    card, sources = _ground_sources(extraction, draft)
    assert card.title == "Курьеры тратят много времени на маршруты"
    assert card.context == draft
    assert sources["title"] in draft and sources["context"] == draft
    assert card.need == ""  # цитата не найдена в тексте — поле обнулено
