// Карточка задачи глазами команды + форма отклика (шаг 6 сценария).
import { useEffect, useState, type FormEvent } from "react";
import { api, CARD_FIELDS, FIELD_LABELS, type Task, type Team } from "../api";
import { ErrorBox, LevelBadge, Loader, ScoreBreakdown, ScoreRing, StatusBadge, useLoad } from "./ui";

interface Props {
  taskId: number;
  team: Team | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function TaskDetail({ taskId, team, onClose, onSubmitted }: Props) {
  const { data: task, error, loading, reload } = useLoad(() => api.task(taskId), [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tm-overlay" onClick={onClose}>
      <aside className="tm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Карточка задачи">
        <button className="tm-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        {loading && <Loader />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {task && (
          <>
            <TaskHeader task={task} />
            {task.needs_clarification && (
              <div className="tm-warn">
                Задача требует уточнения: часть сведений не заполнена. Откликнуться можно, но будьте готовы
                уточнять детали у бизнеса.
              </div>
            )}
            <section className="tm-fields">
              {CARD_FIELDS.filter((f) => f !== "title").map((f) => (
                <div key={f} className={task.card[f] ? "" : "tm-field-empty"}>
                  <h4>{FIELD_LABELS[f]}</h4>
                  <p>{task.card[f] || "Не указано"}</p>
                </div>
              ))}
            </section>
            <section>
              <h3 className="tm-h3">Из чего сложился рейтинг</h3>
              <ScoreBreakdown detail={task.score_detail} />
            </section>
            <ProposalForm
              task={task}
              team={team}
              onSubmitted={() => {
                reload();
                onSubmitted();
              }}
            />
          </>
        )}
      </aside>
    </div>
  );
}

function TaskHeader({ task }: { task: Task }) {
  return (
    <header className="tm-detail-head">
      <ScoreRing score={task.score} size={76} />
      <div>
        <div className="tm-meta">
          <span className="tm-topic">{task.topic}</span>
          <LevelBadge level={task.level} />
          <StatusBadge status={task.status} />
        </div>
        <h2>{task.title}</h2>
        <small className="tm-muted">
          {task.owner} · откликов: {task.proposals_count}
        </small>
        <div className="tm-tags">
          {task.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </header>
  );
}

const EMPTY = { idea: "", plan: "", deadline: "", link: "" };

function ProposalForm({ task, team, onSubmitted }: { task: Task; team: Team | null; onSubmitted: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (task.status === "closed") {
    return <div className="tm-note">Задача закрыта, отклики не принимаются.</div>;
  }
  if (!team) {
    return <div className="tm-note">Выберите команду в шапке, чтобы откликнуться.</div>;
  }
  if (sent) {
    return (
      <div className="tm-success">
        Отклик команды «{team.name}» отправлен. Решение принимает бизнес — статус видно во вкладке «Мои отклики».
        <button className="tm-link" onClick={() => setSent(false)}>
          Отправить ещё один
        </button>
      </div>
    );
  }

  const validate = () => {
    const e: typeof errors = {};
    if (form.idea.trim().length < 10) e.idea = "Опишите идею подробнее (от 10 символов)";
    if (form.plan.trim().length < 10) e.plan = "Опишите план подробнее (от 10 символов)";
    if (form.deadline.trim().length < 2) e.deadline = "Укажите срок";
    try {
      const u = new URL(form.link.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      e.link = "Нужна ссылка вида https://…";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSending(true);
    try {
      await api.createProposal(task.id, {
        team_id: team.id,
        idea: form.idea.trim(),
        plan: form.plan.trim(),
        deadline: form.deadline.trim(),
        link: form.link.trim(),
      });
      setForm(EMPTY);
      setSent(true);
      onSubmitted();
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const field = (key: keyof typeof EMPTY, label: string, multiline: boolean, placeholder: string) => (
    <label className="tm-input">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input value={form[key]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
      {errors[key] && <em>{errors[key]}</em>}
    </label>
  );

  return (
    <form className="tm-form" onSubmit={submit} noValidate>
      <h3 className="tm-h3">Откликнуться от команды «{team.name}»</h3>
      {field("idea", "Идея решения", true, "Что предлагаете сделать и почему это сработает")}
      {field("plan", "План", true, "Этапы и что будет готово на каждом")}
      <div className="tm-row">
        {field("deadline", "Срок", false, "Например, 4 недели")}
        {field("link", "Ссылка на прототип", false, "https://github.com/…")}
      </div>
      {serverError && <ErrorBox error={serverError} />}
      <button className="primary-btn" type="submit" disabled={sending}>
        {sending ? "Отправляем…" : "Отправить отклик"}
      </button>
    </form>
  );
}
