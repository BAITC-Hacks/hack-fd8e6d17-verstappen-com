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
  const [status, setStatus] = useState<TaskStatus | "">("open");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"score" | "newest">("score");
  const meta = useLoad(() => api.meta(), []);
  const list = useLoad(
    () => api.catalog({ topic: topic || undefined, level: level || undefined, status: status || undefined, q: search || undefined }),
    [topic, level, status, search, version],
  );

  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const tasks = [...(list.data ?? [])].sort((a, b) =>
    sort === "score" ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const readyCount = tasks.filter((t) => t.level === "ready" || t.level === "priority").length;
  const totalProposals = tasks.reduce((sum, t) => sum + t.proposals_count, 0);
  const activeFilters = [topic, level, status !== "open" ? status : "", search].filter(Boolean).length;

  const clearFilters = () => {
    setTopic(""); setLevel(""); setStatus("open"); setQ(""); setSearch("");
  };

  return (
    <section className="catalog-page">
      <div className="catalog-hero">
        <div>
          <span className="section-kicker">AI SANA · CHALLENGE MARKETPLACE</span>
          <h1>Найди задачу, которую хочется <span>решить.</span></h1>
          <p className="tm-muted">Реальные бизнес-задачи уже структурированы GPT. Смотри требования, рейтинг готовности и откликайся своей командой.</p>
        </div>
        <div className="catalog-hero-badge"><span>OPEN CHALLENGES</span><strong>{tasks.length}</strong><small>доступно сейчас</small></div>
      </div>

      <div className="catalog-stats">
        <div><span>Открытых задач</span><strong>{tasks.length}</strong></div>
        <div><span>Готовы к старту</span><strong>{readyCount}</strong></div>
        <div><span>Всего откликов</span><strong>{totalProposals}</strong></div>
        <div><span>Средняя готовность</span><strong>{tasks.length ? Math.round(tasks.reduce((s, t) => s + t.score, 0) / tasks.length) : 0}<small>/100</small></strong></div>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-search-wrap"><span>⌕</span><input className="tm-search" placeholder="Поиск по названию, проблеме или данным…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button className="catalog-clear-search" onClick={() => setQ("")}>×</button>}</div>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Тема"><option value="">Все темы</option>{meta.data?.topics.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "score" | "newest")} aria-label="Сортировка"><option value="score">По готовности</option><option value="newest">Сначала новые</option></select>
        <button className="catalog-filter-toggle" onClick={() => setStatus(status === "open" ? "" : "open")}>{status === "open" ? "● Только открытые" : "Все статусы"}</button>
      </div>

      <div className="catalog-subtoolbar">
        <div className="tm-chips" role="group" aria-label="Уровень готовности">
          {([["", "Все"], ["priority", "Приоритет"], ["ready", "Готова"], ["working", "Рабочая"], ["draft", "Черновик"]] as const).map(([value, label]) => <button key={value} className={level === value ? "active" : ""} onClick={() => setLevel(value as Level | "")}>{label}</button>)}
        </div>
        <div className="catalog-filter-meta">{activeFilters > 0 && <><span>{activeFilters} фильтр.</span><button onClick={clearFilters}>Сбросить</button></>}<span>{tasks.length} результатов</span></div>
      </div>

      {list.loading && !list.data && <div className="catalog-loading"><Loader /><span>Загружаем реальные задачи…</span></div>}
      {list.error && <div className="catalog-error"><div><strong>Каталог не подключён</strong><span>{list.error.message}</span><small>Проверь, что FastAPI запущен на http://127.0.0.1:8000, затем нажми «Повторить».</small></div><button onClick={list.reload}>Повторить</button></div>}
      {list.data && tasks.length === 0 && <div className="tm-empty catalog-empty"><strong>По этим фильтрам задач нет</strong><span>Измени фильтры или посмотри все открытые задачи.</span><button onClick={clearFilters}>Сбросить фильтры</button></div>}
      <div className="tm-grid catalog-grid">{tasks.map((t, i) => <TaskItem key={t.id} task={t} position={i + 1} onOpen={onOpen} />)}</div>
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
        <div className="tm-card-copy">
          <h3>{task.title}</h3>
          <div className="tm-card-label">ЧТО НУЖНО РЕШИТЬ</div>
          <p>{task.card.need || task.card.context || "Описание не заполнено"}</p>
        </div>
        <div className="tm-card-score">
          <ScoreRing score={task.score} />
          <span>ГОТОВНОСТЬ</span>
        </div>
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
  const profile = [...new Set([...team.skills, ...team.tech, ...team.interests])];

  return (
    <section className="match-page">
      <div className="match-hero">
        <div>
          <span className="section-kicker">GPT MATCH · TEAM INTELLIGENCE</span>
          <h1>Задачи, которые подходят <span>вашей команде.</span></h1>
          <p className="tm-muted">
            GPT сопоставляет профиль команды с открытыми задачами: навыки, технологии, интересы и содержание задачи.
            Вы сами выбираете, на что откликаться.
          </p>
        </div>
        <div className="match-hero-score">
          <span>ПРОФИЛЬ</span>
          <strong>{profile.length}</strong>
          <small>сигналов для match</small>
        </div>
      </div>

      <div className="match-profile">
        <div>
          <span className="section-kicker">YOUR TEAM</span>
          <h3>{team.name}</h3>
        </div>
        <div className="tm-profile">
          {profile.map((s) => <span key={s}>{s}</span>)}
        </div>
      </div>

      {recs.loading && !recs.data && <Loader />}
      {recs.error && <ErrorBox error={recs.error} onRetry={recs.reload} />}
      {recs.data?.length === 0 && (
        <div className="tm-empty">
          <strong>Пока нет подходящих задач</strong>
          <span>Откройте общий каталог — новые challenges появляются там сразу.</span>
        </div>
      )}

      {recs.data && recs.data.length > 0 && (
        <div className="match-grid">
          {recs.data.map((r, i) => {
            const signals = [...new Set(r.matched)];
            const match = Math.min(98, Math.max(62, Math.round(72 + signals.length * 7 + r.task.score / 20)));
            return (
              <article className="match-card" key={r.task.id} style={{ "--match-delay": "${i * 70}ms" } as CSSProperties}>
                <div className="match-card-top">
                  <span className="match-index">0{i + 1}</span>
                  <span className="match-label">GPT MATCH</span>
                  <strong>{match}%</strong>
                </div>
                <div className="match-card-body">
                  <div>
                    <span className="tm-topic">{r.task.topic}</span>
                    <h3>{r.task.title}</h3>
                    <p>{r.reason}</p>
                  </div>
                  <ScoreRing score={r.task.score} size={62} />
                </div>
                <div className="match-signals">
                  {signals.slice(0, 5).map((s) => <span key={s}>✓ {s}</span>)}
                </div>
                <div className="match-card-foot">
                  <span>{r.task.proposals_count} откликов · {r.task.owner}</span>
                  <button onClick={() => onOpen(r.task.id)}>Посмотреть задачу →</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
