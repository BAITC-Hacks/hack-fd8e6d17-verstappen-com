// Рабочее место студенческой команды: каталог, рекомендации, мои отклики, лидерборд.
import { useEffect, useState } from "react";
import { api, LEVEL_LABELS, type Level, type Proposal, type Task, type TaskStatus, type Team } from "../api";
import { TaskDetail } from "./TaskDetail";
import { ErrorBox, LevelBadge, Loader, ScoreRing, StatusBadge, useLoad } from "./ui";
import "./team.css";

type Tab = "catalog" | "recs" | "mine" | "leaders";

const TABS: { key: Tab; label: string }[] = [
  { key: "catalog", label: "Каталог" },
  { key: "recs", label: "Рекомендации" },
  { key: "mine", label: "Мои отклики" },
  { key: "leaders", label: "Лидерборд" },
];

const TEAM_KEY = "ai-sana-team-id";

function readTeamId(): number | null {
  try {
    const v = localStorage.getItem(TEAM_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function saveTeamId(id: number) {
  try {
    localStorage.setItem(TEAM_KEY, String(id));
  } catch {
    /* приватный режим — не критично */
  }
}

export default function TeamApp() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [teamId, setTeamId] = useState<number | null>(readTeamId);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [version, setVersion] = useState(0); // для перезагрузки списков после отклика
  const teams = useLoad(() => api.teams(), [version]);

  useEffect(() => {
    if (teams.data?.length && !teams.data.some((t) => t.id === teamId)) setTeamId(teams.data[0].id);
  }, [teams.data, teamId]);

  const team = teams.data?.find((t) => t.id === teamId) ?? null;

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
          <nav className="tm-tabs" aria-label="Разделы">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
          <label className="tm-team-select">
            <span>Команда</span>
            <select
              value={teamId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setTeamId(id);
                saveTeamId(id);
              }}
            >
              {teams.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.points} очк.
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="tm-main">
        {teams.error && <ErrorBox error={teams.error} onRetry={teams.reload} />}
        {tab === "catalog" && <Catalog onOpen={setOpenTask} version={version} />}
        {tab === "recs" && team && <Recommendations team={team} onOpen={setOpenTask} version={version} />}
        {tab === "mine" && team && <MyProposals team={team} onOpen={setOpenTask} version={version} />}
        {tab === "leaders" && <Leaderboard currentId={teamId} version={version} />}
      </main>

      {openTask !== null && (
        <TaskDetail
          taskId={openTask}
          team={team}
          onClose={() => setOpenTask(null)}
          onSubmitted={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

// ---------- Каталог ----------

function Catalog({ onOpen, version }: { onOpen: (id: number) => void; version: number }) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level | "">("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const meta = useLoad(() => api.meta(), []);
  const list = useLoad(
    () => api.catalog({ topic: topic || undefined, level: level || undefined, status: status || undefined, q: search || undefined }),
    [topic, level, status, search, version],
  );

  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <section>
      <div className="tm-title">
        <div>
          <span className="section-kicker">ОБЩИЙ КАТАЛОГ</span>
          <h1>Задачи от бизнеса</h1>
          <p className="tm-muted">
            Все опубликованные задачи. Чем выше рейтинг готовности, тем выше задача в списке и тем проще начать работу.
          </p>
        </div>
      </div>

      <div className="tm-filters">
        <input className="tm-search" placeholder="Поиск по задачам" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Тема">
          <option value="">Все темы</option>
          {meta.data?.topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} aria-label="Статус">
          <option value="">Любой статус</option>
          <option value="open">Открыта</option>
          <option value="in_progress">В работе</option>
          <option value="closed">Закрыта</option>
        </select>
        <div className="tm-chips" role="group" aria-label="Уровень готовности">
          <button className={level === "" ? "active" : ""} onClick={() => setLevel("")}>
            Все уровни
          </button>
          {(["priority", "ready", "working", "draft"] as Level[]).map((l) => (
            <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {list.loading && !list.data && <Loader />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <div className="tm-empty">По этим фильтрам задач нет</div>}
      <div className="tm-grid">
        {list.data?.map((t, i) => (
          <TaskItem key={t.id} task={t} position={i + 1} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function TaskItem({ task, position, onOpen, reason }: { task: Task; position?: number; onOpen: (id: number) => void; reason?: string }) {
  return (
    <button className={`tm-card tm-card-${task.level} ${task.status === "closed" ? "tm-card-closed" : ""}`} onClick={() => onOpen(task.id)}>
      <div className="tm-card-top">
        {position !== undefined && <span className="tm-pos">#{position}</span>}
        <span className="tm-topic">{task.topic}</span>
        <LevelBadge level={task.level} />
        {task.status !== "open" && <StatusBadge status={task.status} />}
      </div>
      <div className="tm-card-body">
        <div>
          <h3>{task.title}</h3>
          <p>{task.card.need || task.card.context || "Описание не заполнено"}</p>
        </div>
        <ScoreRing score={task.score} />
      </div>
      {reason && <div className="tm-reason">✓ {reason}</div>}
      {task.needs_clarification && <div className="tm-warn-sm">Требует уточнения</div>}
      <div className="tm-card-foot">
        <span>{task.owner}</span>
        <span>откликов: {task.proposals_count}</span>
      </div>
    </button>
  );
}

// ---------- Рекомендации ----------

function Recommendations({ team, onOpen, version }: { team: Team; onOpen: (id: number) => void; version: number }) {
  const recs = useLoad(() => api.recommendations(team.id), [team.id, version]);
  return (
    <section>
      <div className="tm-title">
        <div>
          <span className="section-kicker">ДЛЯ КОМАНДЫ {team.name.toUpperCase()}</span>
          <h1>Рекомендованные задачи</h1>
          <p className="tm-muted">
            Подбор по совпадению навыков, интересов и технологий команды с темой задачи. Рекомендуются только открытые задачи
            с рейтингом от 40. Каталог при этом доступен целиком.
          </p>
        </div>
      </div>
      <div className="tm-profile">
        {[...team.skills, ...team.tech, ...team.interests].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      {recs.loading && !recs.data && <Loader />}
      {recs.error && <ErrorBox error={recs.error} onRetry={recs.reload} />}
      {recs.data?.length === 0 && <div className="tm-empty">Подходящих задач пока нет — загляните в общий каталог</div>}
      <div className="tm-grid">
        {recs.data?.map((r) => (
          <TaskItem key={r.task.id} task={r.task} onOpen={onOpen} reason={r.reason} />
        ))}
      </div>
    </section>
  );
}

// ---------- Мои отклики ----------

const PROPOSAL_STATUS: Record<Proposal["status"], string> = {
  pending: "На рассмотрении",
  accepted: "Команда выбрана",
  rejected: "Отклонён",
};

function MyProposals({ team, onOpen, version }: { team: Team; onOpen: (id: number) => void; version: number }) {
  const list = useLoad(() => api.teamProposals(team.id), [team.id, version]);
  return (
    <section>
      <div className="tm-title">
        <div>
          <span className="section-kicker">КОМАНДА {team.name.toUpperCase()}</span>
          <h1>Мои отклики</h1>
          <p className="tm-muted">Решение по каждому отклику принимает бизнес вручную.</p>
        </div>
        <div className="tm-points">
          <strong>{team.points}</strong>
          <span>очков за прогресс</span>
        </div>
      </div>
      {list.loading && !list.data && <Loader />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data?.length === 0 && <div className="tm-empty">Откликов пока нет — выберите задачу в каталоге</div>}
      <div className="tm-list">
        {list.data?.map((p) => (
          <article key={p.id} className="tm-prop">
            <div className="tm-prop-head">
              <button className="tm-link" onClick={() => onOpen(p.task_id)}>
                {p.task_title}
              </button>
              <span className={`tm-pstatus tm-pstatus-${p.status}`}>{PROPOSAL_STATUS[p.status]}</span>
            </div>
            <p>{p.idea}</p>
            <small className="tm-muted">
              Срок: {p.deadline} ·{" "}
              <a href={p.link} target="_blank" rel="noreferrer">
                прототип
              </a>
            </small>
            {p.milestones.length > 0 && (
              <ul className="tm-milestones">
                {p.milestones.map((m, i) => (
                  <li key={i}>
                    ✓ {m.note} <b>+{m.points}</b>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- Лидерборд ----------

function Leaderboard({ currentId, version }: { currentId: number | null; version: number }) {
  const list = useLoad(() => api.leaderboard(), [version]);
  return (
    <section>
      <div className="tm-title">
        <div>
          <span className="section-kicker">ФАКТИЧЕСКИЙ ПРОГРЕСС</span>
          <h1>Лидерборд команд</h1>
          <p className="tm-muted">Очки начисляются только за этапы, которые подтвердил бизнес, — не за количество откликов.</p>
        </div>
      </div>
      {list.loading && !list.data && <Loader />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      <ol className="tm-leaders">
        {list.data?.map((t, i) => (
          <li key={t.id} className={t.id === currentId ? "me" : ""}>
            <span className="tm-rank">{i + 1}</span>
            <div>
              <b>{t.name}</b>
              <small>{[...t.skills, ...t.tech].join(" · ")}</small>
            </div>
            <strong>{t.points}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
