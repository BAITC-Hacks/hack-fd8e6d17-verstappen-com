// Рабочее место бизнеса: мои задачи, улучшение карточки с пересчётом рейтинга,
// отклики команд и ручной выбор (шаги 7–8 сценария).
import { useEffect, useMemo, useState } from "react";
import { api, CARD_FIELDS, FIELD_LABELS, type CardField, type Proposal, type ScoreResult, type Task, type TaskCard } from "../api";
import { go } from "../router";
import { ErrorBox, LevelBadge, Loader, ScoreBreakdown, ScoreRing, StatusBadge, useLoad } from "../team/ui";
import "../team/team.css";
import "./business.css";

const OWNER_KEY = "ai-sana-owner";
const ALL = "__all__";

function readOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? ALL;
  } catch {
    return ALL;
  }
}

export function rememberOwner(owner: string) {
  try {
    localStorage.setItem(OWNER_KEY, owner);
  } catch {
    /* приватный режим — не критично */
  }
}

export default function BusinessApp({ route }: { route: string }) {
  // #/business/12 — сразу открыть задачу 12 (переход из мастера после публикации)
  const routeTaskId = Number(route.split("/")[2]) || null;
  const [owner, setOwner] = useState(readOwner);
  const [selected, setSelected] = useState<number | null>(routeTaskId);
  const [version, setVersion] = useState(0);
  const all = useLoad(() => api.catalog(), [version]);

  useEffect(() => {
    if (routeTaskId) setSelected(routeTaskId);
  }, [routeTaskId]);

  const owners = useMemo(
    () => [...new Set((all.data ?? []).map((t) => t.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [all.data],
  );
  const tasks = (all.data ?? []).filter((t) => owner === ALL || t.owner === owner);

  // Если выбранная задача не принадлежит текущей компании — переключаемся на её компанию
  useEffect(() => {
    const t = all.data?.find((x) => x.id === selected);
    if (t && owner !== ALL && t.owner !== owner) setOwner(t.owner);
  }, [all.data, selected, owner]);

  const changeOwner = (o: string) => {
    setOwner(o);
    rememberOwner(o);
    setSelected(null);
    go("/business");
  };

  return (
    <div className="tm-app">
      <header className="navbar">
        <div className="nav-inner">
          <a className="logo tm-logo" href="#/">
            <span className="logo-mark">✦</span>
            <span>
              AI <b>SANA</b>
            </span>
          </a>
          <nav className="tm-tabs" aria-label="Роль">
            <button className="active">Бизнес</button>
            <button onClick={() => go("/team")}>Команда</button>
          </nav>
          <div className="bz-head-actions">
            <label className="tm-team-select">
              <span>Компания</span>
              <select value={owner} onChange={(e) => changeOwner(e.target.value)}>
                <option value={ALL}>Все компании</option>
                {owners.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <button className="primary-btn" onClick={() => go("/new")}>
              + Новая задача
            </button>
          </div>
        </div>
      </header>

      <main className="tm-main bz-layout">
        <aside className="bz-list">
          <div className="tm-title">
            <div>
              <span className="section-kicker">КАБИНЕТ БИЗНЕСА</span>
              <h1>Мои задачи</h1>
            </div>
          </div>
          {all.loading && !all.data && <Loader />}
          {all.error && <ErrorBox error={all.error} onRetry={all.reload} />}
          {all.data && tasks.length === 0 && <div className="tm-empty">Задач пока нет — создайте первую</div>}
          {tasks.map((t) => (
            <button
              key={t.id}
              className={`bz-item ${t.id === selected ? "active" : ""} ${t.status === "closed" ? "tm-card-closed" : ""}`}
              onClick={() => {
                setSelected(t.id);
                go(`/business/${t.id}`);
              }}
            >
              <ScoreRing score={t.score} size={48} />
              <div>
                <b>{t.title}</b>
                <div className="tm-meta">
                  <LevelBadge level={t.level} />
                  {t.status !== "open" && <StatusBadge status={t.status} />}
                </div>
              </div>
              <span className={`bz-count ${t.proposals_count ? "has" : ""}`} title="Откликов">
                {t.proposals_count}
              </span>
            </button>
          ))}
        </aside>

        <section className="bz-detail">
          {selected === null ? (
            <div className="tm-empty bz-placeholder">
              Выберите задачу слева, чтобы посмотреть отклики команд и улучшить карточку
            </div>
          ) : (
            <TaskWorkspace key={selected} taskId={selected} onChanged={() => setVersion((v) => v + 1)} />
          )}
        </section>
      </main>
    </div>
  );
}

// ---------- Задача: отклики и карточка ----------

type Pane = "proposals" | "card";

function TaskWorkspace({ taskId, onChanged }: { taskId: number; onChanged: () => void }) {
  const [pane, setPane] = useState<Pane>("proposals");
  const task = useLoad(() => api.task(taskId), [taskId]);
  const proposals = useLoad(() => api.taskProposals(taskId), [taskId]);

  const refresh = () => {
    task.reload();
    proposals.reload();
    onChanged();
  };

  if (task.loading && !task.data) return <Loader />;
  if (task.error) return <ErrorBox error={task.error} onRetry={task.reload} />;
  if (!task.data) return null;
  const t = task.data;
  const pending = proposals.data?.filter((p) => p.status === "pending").length ?? 0;

  const close = async () => {
    if (!window.confirm("Закрыть задачу? Новые отклики перестанут приниматься.")) return;
    await api.closeTask(t.id);
    refresh();
  };

  return (
    <div className="bz-work">
      <header className="tm-detail-head bz-head">
        <ScoreRing score={t.score} size={76} />
        <div>
          <div className="tm-meta">
            <span className="tm-topic">{t.topic}</span>
            <LevelBadge level={t.level} />
            <StatusBadge status={t.status} />
          </div>
          <h2>{t.title}</h2>
          <ScoreTrail history={t.score_history} />
        </div>
        {t.status !== "closed" && (
          <button className="secondary-btn bz-close" onClick={close}>
            Закрыть задачу
          </button>
        )}
      </header>

      <div className="tm-chips bz-panes">
        <button className={pane === "proposals" ? "active" : ""} onClick={() => setPane("proposals")}>
          Отклики команд · {proposals.data?.length ?? "…"}
          {pending > 0 && <i className="bz-dot">{pending} новых</i>}
        </button>
        <button className={pane === "card" ? "active" : ""} onClick={() => setPane("card")}>
          Карточка и рейтинг
        </button>
      </div>

      {pane === "proposals" ? (
        <Proposals task={t} state={proposals} onChanged={refresh} />
      ) : (
        <CardEditor task={t} onSaved={refresh} />
      )}
    </div>
  );
}

function ScoreTrail({ history }: { history: { score: number }[] }) {
  if (history.length < 2) return <small className="tm-muted">Рейтинг готовности задачи</small>;
  const points = history.slice(-6).map((h) => h.score);
  return (
    <small className="bz-trail">
      Рост рейтинга:{" "}
      {points.map((p, i) => (
        <span key={i}>
          {i > 0 && " → "}
          <b>{p}</b>
        </span>
      ))}
    </small>
  );
}

// ---------- Отклики: ручной выбор ----------

const PROPOSAL_STATUS: Record<Proposal["status"], string> = {
  pending: "Ждёт решения",
  accepted: "Команда выбрана",
  rejected: "Отклонён",
};

function Proposals({
  task,
  state,
  onChanged,
}: {
  task: Task;
  state: { data: Proposal[] | null; error: string | null; loading: boolean; reload: () => void };
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: number, action: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <Loader />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  const list = state.data ?? [];

  return (
    <div>
      <p className="tm-muted bz-note">
        Сравните предложения и решите сами: можно выбрать одну команду, несколько или ни одной. Система не выбирает
        команду за вас.
      </p>
      {error && <ErrorBox error={error} />}
      {list.length === 0 && (
        <div className="tm-empty">
          Откликов пока нет. Задача видна всем командам в каталоге
          {task.level === "draft" ? " — дополните карточку, чтобы её начали рекомендовать" : ""}.
        </div>
      )}
      <div className="bz-proposals">
        {list.map((p) => {
          const nextStage = p.milestones.length + 1;
          return (
            <article key={p.id} className={`bz-prop bz-prop-${p.status}`}>
              <header>
                <div>
                  <b>{p.team.name}</b>
                  <small>{[...p.team.skills, ...p.team.tech].join(" · ")}</small>
                </div>
                <span className={`tm-pstatus tm-pstatus-${p.status}`}>{PROPOSAL_STATUS[p.status]}</span>
              </header>
              <dl>
                <dt>Идея</dt>
                <dd>{p.idea}</dd>
                <dt>План</dt>
                <dd>{p.plan}</dd>
                <dt>Срок</dt>
                <dd>{p.deadline}</dd>
                <dt>Прототип</dt>
                <dd>
                  <a href={p.link} target="_blank" rel="noreferrer">
                    {p.link.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </dl>

              {p.status === "pending" && task.status !== "closed" && (
                <div className="bz-actions">
                  <button className="primary-btn" disabled={busy === p.id} onClick={() => run(p.id, () => api.decide(p.id, "accept"))}>
                    Выбрать команду
                  </button>
                  <button className="secondary-btn" disabled={busy === p.id} onClick={() => run(p.id, () => api.decide(p.id, "reject"))}>
                    Отклонить
                  </button>
                </div>
              )}

              {p.status === "accepted" && (
                <div className="bz-stages">
                  {p.milestones.map((m, i) => (
                    <div key={i} className="bz-stage">
                      ✓ {m.note} <b>+{m.points}</b>
                    </div>
                  ))}
                  <button
                    className="secondary-btn"
                    disabled={busy === p.id}
                    onClick={() => run(p.id, () => api.milestone(p.id, `Этап ${nextStage} подтверждён`))}
                  >
                    Подтвердить этап {nextStage} · команде +20 очков
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Карточка: правка с живым пересчётом ----------

function CardEditor({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const [card, setCard] = useState<TaskCard>(task.card);
  const [preview, setPreview] = useState<ScoreResult>(task.score_detail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDelta, setSavedDelta] = useState<number | null>(null);

  const changed = CARD_FIELDS.filter((f) => card[f] !== task.card[f]);

  useEffect(() => {
    const id = setTimeout(() => {
      api
        .score(card, CARD_FIELDS.filter((f) => card[f].trim()))
        .then(setPreview)
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(id);
  }, [card]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch = Object.fromEntries(changed.map((f) => [f, card[f]])) as Partial<TaskCard>;
      const updated = await api.updateTask(task.id, { card: patch });
      setSavedDelta(updated.score - task.score);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const delta = preview.total - task.score;
  const byField = (f: CardField) => preview.hints.find((h) => h.field === f);

  return (
    <div className="bz-editor">
      <div className="bz-fields">
        {CARD_FIELDS.map((f) => {
          const hint = byField(f);
          return (
            <label key={f} className={`tm-input bz-field ${hint ? "bz-field-hint" : ""}`}>
              <span>
                {FIELD_LABELS[f]}
                {hint && hint.gain > 0 && <em className="bz-gain">+{hint.gain}</em>}
              </span>
              <textarea
                rows={f === "title" || f === "contact" ? 1 : 3}
                value={card[f]}
                onChange={(e) => {
                  setSavedDelta(null);
                  setCard({ ...card, [f]: e.target.value });
                }}
              />
              {hint && <small>{hint.text}</small>}
            </label>
          );
        })}
      </div>

      <aside className="bz-score">
        <div className="bz-score-top">
          <ScoreRing score={preview.total} size={92} />
          <div>
            <strong>{preview.level_label}</strong>
            {delta !== 0 && (
              <span className={delta > 0 ? "bz-up" : "bz-down"}>
                {delta > 0 ? "+" : ""}
                {delta} после сохранения
              </span>
            )}
            {preview.next_level_at !== null && (
              <small className="tm-muted">До следующего уровня: {preview.next_level_at - preview.total}</small>
            )}
          </div>
        </div>
        <ScoreBreakdown detail={preview} />
        {error && <ErrorBox error={error} />}
        {savedDelta !== null && changed.length === 0 && (
          <div className="tm-success">
            Сохранено. Рейтинг {savedDelta >= 0 ? "вырос" : "изменился"} на {savedDelta}, позиция в каталоге пересчитана.
          </div>
        )}
        <button className="primary-btn" disabled={!changed.length || saving} onClick={save}>
          {saving ? "Сохраняем…" : changed.length ? `Сохранить изменения (${changed.length})` : "Изменений нет"}
        </button>
      </aside>
    </div>
  );
}
