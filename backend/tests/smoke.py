"""Смоук-тест живого приложения через прокси фронта: весь сценарий из ТЗ.

Запуск: python tests/smoke.py http://localhost:5174
Только стандартная библиотека — работает без установки зависимостей.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173").rstrip("/")
results: list[tuple[bool, str]] = []


def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw.strip().startswith(("{", "[")) else raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def check(ok: bool, name: str) -> bool:
    results.append((ok, name))
    print(("  ✓ " if ok else "  ✗ ") + name)
    return ok


def main() -> int:
    s, page = call("GET", "/")
    check(s == 200 and 'id="root"' in str(page), "Фронт отдаёт страницу")
    s, h = call("GET", "/api/health")
    if not check(s == 200 and h == {"status": "ok"}, "Прокси фронт → API работает"):
        return 1

    draft = "Абитуриенты задают одни и те же вопросы в директ, приёмная комиссия не успевает отвечать."
    s, a = call("POST", "/api/analyze", {"text": draft})
    check(s == 200 and len(a["questions"]) >= 3, f"1–2. Черновик → {len(a['questions'])} уточняющих вопросов")
    weak = a["score"]["total"]

    answers = [
        {"field": "need", "answer": "Бот должен отвечать на типовые вопросы о поступлении круглосуточно."},
        {"field": "users", "answer": "Абитуриенты 9–11 классов и их родители."},
        {"field": "data", "answer": "База из 150 частых вопросов с ответами и правила приёма в PDF."},
        {"field": "expected_result", "answer": "Telegram-бот с базой ответов и передачей сложных вопросов оператору."},
        {"field": "success_criteria", "answer": "Бот закрывает 70% обращений без оператора за первый месяц."},
        {"field": "constraints", "answer": "Запуск до 1 июня, только Telegram, без платных сервисов."},
        {"field": "contact", "answer": "priem@college.kz"},
        {"field": "interaction_format", "answer": "Созвон раз в неделю, ответы в чате в течение дня."},
    ]
    s, b = call("POST", "/api/build-card", {"text": draft, "answers": answers})
    card = b["card"]
    check(s == 200 and all(f in b["sources"] for f, v in card.items() if v), "3. Карточка собрана, у каждого поля есть источник")
    strong = b["score"]["total"]
    check(strong > weak, f"4. Рейтинг вырос: {weak} → {strong} ({b['score']['level_label']})")

    s, task = call("POST", "/api/tasks", {
        "card": card, "topic": "Образование", "tags": ["Чат-бот", "Telegram", "NLP"], "owner": "Смоук-тест",
        "draft_text": draft, "confirmed_fields": [f for f, v in card.items() if v],
    })
    check(s == 201, "5. Задача опубликована")
    s, catalog = call("GET", "/api/catalog")
    ids = [t["id"] for t in catalog]
    check(task["id"] in ids, f"5. Задача в каталоге на позиции #{ids.index(task['id']) + 1} из {len(ids)}")
    scores = [t["score"] for t in catalog if t["status"] != "closed"]
    check(scores == sorted(scores, reverse=True), "5. Каталог отсортирован по рейтингу")
    check(any(t["needs_clarification"] for t in catalog), "5. Черновики видны в каталоге")

    s, recs = call("GET", "/api/recommendations?team_id=4")
    check(s == 200 and all(r["task"]["score"] >= 40 for r in recs), "6. Рекомендации только для задач 40+")

    s, bad = call("POST", f"/api/tasks/{task['id']}/proposals", {"team_id": 4, "idea": "Идея решения", "plan": "План работ", "deadline": "3 недели", "link": "не ссылка"})
    check(s == 422, "6. Неверная ссылка в отклике отклоняется (422)")
    s, prop = call("POST", f"/api/tasks/{task['id']}/proposals", {
        "team_id": 4, "idea": "Бот на aiogram с поиском по базе вопросов", "plan": "Неделя 1 — база, неделя 2 — бот, неделя 3 — пилот",
        "deadline": "3 недели", "link": "https://github.com/botfactory/admission",
    })
    check(s == 201 and prop["status"] == "pending", "6. Команда откликнулась, авто-назначения нет")

    s, dec = call("POST", f"/api/proposals/{prop['id']}/decision", {"decision": "accept"})
    check(s == 200 and dec["status"] == "accepted", "7. Бизнес вручную выбрал команду")
    s, _ = call("POST", f"/api/proposals/{prop['id']}/decision", {"decision": "reject"})
    check(s == 409, "7. Повторное решение запрещено (409)")

    s, before = call("GET", "/api/teams/4")
    s, _ = call("POST", f"/api/proposals/{prop['id']}/milestone", {"note": "Прототип бота сдан"})
    s, after = call("GET", "/api/teams/4")
    check(after["points"] > before["points"], f"8. Этап подтверждён: очки команды {before['points']} → {after['points']}")

    s, t2 = call("PATCH", f"/api/tasks/{task['id']}", {"card": {"success_criteria": "Меньше"}})
    check(t2["score"] < strong and len(t2["score_history"]) >= 2, f"Правка пересчитывает рейтинг: {strong} → {t2['score']}")

    failed = [n for ok, n in results if not ok]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
