"""Transparent rule checks for whether a business task can be tested by a team."""
import re

from app.schemas import TaskCard, TestDriveFinding, TestDriveResult

MEASURABLE = re.compile(
    r"\d|%|процент|доля|не ниже|не более|сократ|увелич|точност|полнота|"
    r"срок|дней|недел|месяц|секунд|минут|рубл|тенге|шт\b|раза|"
    r"baseline|precision|recall|accuracy|f1\b|\b\d+x\b",
    re.IGNORECASE,
)
SOLUTION_OUTPUT = re.compile(
    r"модел|прогноз|аналит|сервис|систем|прототип|отч[её]т|дашборд|"
    r"алгоритм|классифик|recommend|model|prototype|dashboard",
    re.IGNORECASE,
)
NO_DATA = re.compile(r"^(?:нет\b|отсутств\w*|не предостав\w*|пока нет\b|не знаю\b|не определ\w*|-)\s*", re.I)


def inspect_task(card: TaskCard) -> TestDriveResult:
    """Return only explainable completeness/testability findings, without LLM guesses."""
    findings: list[TestDriveFinding] = []

    if card.need and not card.context:
        findings.append(TestDriveFinding(
            key="need_without_context", field="context", severity="high",
            title="Потребность не привязана к текущему процессу",
            detail="Команда видит, что нужно изменить, но не знает, как задача решается сейчас.",
            suggestion="Добавьте краткое описание текущего процесса и места, где возникает проблема.",
        ))

    if card.expected_result and not card.success_criteria:
        findings.append(TestDriveFinding(
            key="result_without_criteria", field="success_criteria", severity="high",
            title="Результат нельзя принять по заданным критериям",
            detail="Ожидаемый результат указан, но карточка не задаёт способ проверить его готовность.",
            suggestion="Укажите измеримый порог, срок или проверяемый сценарий приёмки.",
        ))
    elif card.success_criteria and not MEASURABLE.search(card.success_criteria):
        findings.append(TestDriveFinding(
            key="criteria_not_measurable", field="success_criteria", severity="medium",
            title="Критерий успеха выглядит неизмеримым",
            detail="В тексте критерия не найдено числа, порога, срока или известной метрики. Проверьте, что результат можно однозначно принять.",
            suggestion="Добавьте целевое значение и способ измерения, например точность не ниже 85% на тестовой выборке.",
        ))

    if card.expected_result and SOLUTION_OUTPUT.search(card.expected_result):
        data = card.data.strip()
        if not data or NO_DATA.search(data):
            findings.append(TestDriveFinding(
                key="solution_without_data", field="data", severity="high",
                title="Для заявленного результата не описаны исходные данные",
                detail="Результат предполагает модель, аналитику или программный артефакт, а данные и материалы не указаны.",
                suggestion="Перечислите доступные данные или явно укажите, что команда должна работать без них.",
            ))

    if card.contact and not card.interaction_format:
        findings.append(TestDriveFinding(
            key="contact_without_format", field="interaction_format", severity="low",
            title="Контакт есть, формат работы с заказчиком не задан",
            detail="Команда сможет связаться с владельцем задачи, но не знает, как получать обратную связь.",
            suggestion="Укажите канал и доступность: например, созвон раз в неделю или ответы в Telegram в течение двух дней.",
        ))

    return TestDriveResult(findings=findings, passed=not any(f.severity == "high" for f in findings))
