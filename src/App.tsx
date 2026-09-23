import { useEffect, useState } from "react";
import "./sana-wow.css";
import { api, CARD_FIELDS, FIELD_LABELS, type AnalyzeResult, type BuildCardResult, type CardField, type ScoreResult, type TaskCard, type TestDriveResult } from "./api";
import { rememberOwner } from "./business/BusinessApp";
import { go } from "./router";

type Role = "business" | "team";
type BuilderStep = 1 | 2 | 3 | 4;

const Arrow = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>;
const Check = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.5 3.5L16 5" /></svg>;

const fields = [
  ["Problem", 15], ["Target users", 10], ["Business context", 10], ["Desired outcome", 10],
  ["Success metric", 15], ["Data available", 10], ["Constraints", 10], ["Timeline", 10],
  ["Skills needed", 5], ["Contact / owner", 5]
] as const;

const FALLBACK_TOPICS = ["Ритейл", "Финтех", "Образование", "Логистика", "HoReCa", "Медицина", "Госсектор", "Агро", "Другое"];
// Теги влияют на рекомендации: задачу увидят команды с совпадающими навыками
const TAG_SUGGESTIONS = ["Python", "ML", "NLP", "Чат-бот", "Telegram", "Backend", "Аналитика", "Computer Vision", "Автоматизация", "Оптимизация"];

const emptyCard = (): TaskCard => Object.fromEntries(CARD_FIELDS.map((field) => [field, ""])) as TaskCard;

function App() {
  const [role, setRole] = useState<Role>("business");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [step, setStep] = useState<BuilderStep>(1);
  const [problem, setProblem] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [built, setBuilt] = useState<BuildCardResult | null>(null);
  const [card, setCard] = useState<TaskCard>(emptyCard);
  const [liveScore, setLiveScore] = useState<ScoreResult | null>(null);
  const [testDrive, setTestDrive] = useState<TestDriveResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [topics, setTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [topic, setTopic] = useState("Другое");
  const [tags, setTags] = useState<string[]>([]);
  const [owner, setOwner] = useState("");

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openBuilder = () => {
    setRole("business");
    setBuilderOpen(true);
    setStep(1);
    setProblem("");
    setAnalysis(null);
    setAnswers({});
    setBuilt(null);
    setCard(emptyCard());
    setLiveScore(null);
    setTestDrive(null);
    setConfirmed(false);
    setPublishedId(null);
    setError("");
    setTopic("Другое");
    setTags([]);
    setOwner("");
    api.meta().then((m) => setTopics(m.topics)).catch(() => undefined);
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    if (window.location.hash === "#/new") go("/");
  };

  // #/new открывает мастер (кнопка «Новая задача» в кабинете бизнеса)
  useEffect(() => {
    const check = () => { if (window.location.hash === "#/new") openBuilder(); };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Пример для демо: черновик из тестовых данных + его отрасль
  const fillExample = async () => {
    try {
      const drafts = await api.demoDrafts();
      // тот же пример, что в сценарии демо (README): «Абитуриенты задают одни и те же вопросы…»
      const d = drafts.find((x) => x.industry === "Образование") ?? drafts[0];
      if (d) { setProblem(d.text); setTopic(d.industry); }
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить пример"); }
  };

  const toggleTag = (tag: string) => setTags((old) => old.includes(tag) ? old.filter((t) => t !== tag) : [...old, tag]);

  const analyzeDraft = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.analyze(problem);
      setAnalysis(result);
      setAnswers(Object.fromEntries(result.questions.map((q) => [q.field, ""])));
      setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось проанализировать черновик"); }
    finally { setBusy(false); }
  };

  const buildCard = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.buildCard(problem, Object.entries(answers).filter(([, answer]) => answer.trim()).map(([field, answer]) => ({ field: field as CardField, answer })));
      setBuilt(result); setCard(result.card); setLiveScore(result.score);
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось собрать карточку"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!builderOpen || step !== 3 || !built) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      Promise.all([api.score(card), api.testDrive(card)]).then(([scoreResult, driveResult]) => {
        if (alive) { setLiveScore(scoreResult); setTestDrive(driveResult); }
      }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Не удалось проверить карточку"); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [builderOpen, step, card, built]);

  const publish = async () => {
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      const result = await api.createTask({
        card,
        topic,
        tags,
        owner: owner.trim() || card.contact,
        draft_text: problem,
        confirmed_fields: CARD_FIELDS.filter((field) => Boolean(card[field].trim())),
      });
      setPublishedId(result.id);
      rememberOwner(result.owner);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось опубликовать задачу"); }
    finally { setBusy(false); }
  };

  const previousStep = () => setStep((value) => Math.max(1, value - 1) as BuilderStep);

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-inner">
          <button className="logo" onClick={() => scrollTo("top")} aria-label="AI SANA home">
            <span className="logo-mark"><Spark /></span><span>AI <b>SANA</b></span>
          </button>
          <nav className="nav-links" aria-label="Main navigation">
            <button onClick={() => scrollTo("how")}>How it works</button>
            <button onClick={() => scrollTo("features")}>Features</button>
            <button onClick={() => scrollTo("explore")}>Challenges</button>
          </nav>
          <div className="nav-actions">
            <div className="role-switch" aria-label="Choose your role">
              <button className={role === "business" ? "active" : ""} onClick={() => { setRole("business"); go("/business"); }}>Business</button>
              <button className={role === "team" ? "active" : ""} onClick={() => { setRole("team"); window.location.hash = "/team"; }}>Team</button>
            </div>
            <button className="nav-cta" onClick={role === "business" ? openBuilder : () => scrollTo("explore")}>{
              role === "business" ? "Create challenge" : "Explore challenges"
            } <Arrow /></button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="hero">
          <div className="hero-glow glow-one" /><div className="hero-glow glow-two" />
          <div className="hero-content">
            <div className="eyebrow"><span className="pulse" /> AI-powered challenge builder</div>
            <h1>Turn business problems into <span>real challenges.</span></h1>
            <p className="hero-copy">AI SANA helps businesses structure a real problem, measure challenge readiness, and connect it with student teams ready to build solutions.</p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={openBuilder}>Create a challenge <Arrow /></button>
              <button className="secondary-btn" onClick={() => scrollTo("explore")}>Explore challenges</button>
            </div>
            <div className="trust-row"><div className="avatars"><span>AS</span><span>MK</span><span>DN</span><span>+</span></div><div><strong>Built for real teams</strong><small>From idea → validated challenge</small></div></div>
          </div>

          <div className="hero-visual float-card" aria-label="Challenge readiness preview">
            <div className="visual-top"><span>Challenge readiness</span><span className="live-dot">● Live</span></div>
            <div className="score-ring"><div className="ring-inner"><strong>82</strong><span>/ 100</span><small>READY</small></div></div>
            <div className="score-caption"><strong>Strong challenge</strong><span>AI analysis is complete</span></div>
            <div className="field-list">
              {fields.slice(0,4).map(([name, points], index) => <div key={name}><span className={"check " + (index === 3 ? "muted" : "")}><Check /></span><div><b>{name}</b><small>{index === 3 ? "Partially filled" : index === 2 ? "Needs refinement" : "Clearly defined"}</small></div><em>{index === 2 ? "12/15" : index === 3 ? "8/10" : points + "/" + points}</em></div>)}
            </div>
            <button className="mini-btn" onClick={openBuilder}>Improve score <Arrow /></button>
          </div>
        </section>

        <section className="stats reveal" id="stats">
          <div><strong>10</strong><span>structured fields</span></div><div><strong>0–100</strong><span>readiness score</span></div><div><strong>3+</strong><span>AI clarification questions</span></div><div><strong>1</strong><span>real path to a team</span></div>
        </section>

        <section className="section reveal sana-features" id="features">
          <div className="section-heading"><div><span className="section-kicker">THE AI SANA LOOP</span><h2>From one sentence<br/><span>to measurable impact.</span></h2></div><p>One interface connects the full journey: AI clarification, transparent readiness, team matching, human selection and measurable outcomes.</p></div>
          <div className="sana-feature-grid">
            <article className="sana-feature sana-feature-ai">
              <div className="sana-feature-head"><span className="sana-icon"><Spark /></span><span>01 · GPT COPILOT</span></div>
              <h3>Your challenge has an AI partner.</h3>
              <p>Instead of a long form, the business gets focused questions and practical suggestions while building the task.</p>
              <div className="copilot-mini">
                <div className="copilot-title"><span className="ai-dot" /> GPT Copilot <span>LIVE</span></div>
                <div className="copilot-msg">I found 3 missing details that can improve your challenge.</div>
                <div className="copilot-question">＋ What is the measurable success metric?</div>
                <div className="copilot-question">＋ Which data can the team access?</div>
              </div>
            </article>
            <article className="sana-feature">
              <div className="sana-feature-head"><span className="sana-icon">✓</span><span>02 · EXPLAINABLE SCORE</span></div>
              <h3>Not just 82/100. Know why.</h3>
              <p>Every point is traceable to a concrete part of the challenge, with clear next steps.</p>
              <div className="score-bars">
                <div><span>Context</span><b>10/10</b><i style={{width:"100%"}} /></div>
                <div><span>Success metric</span><b>8/15</b><i style={{width:"53%"}} /></div>
                <div><span>Data</span><b>15/20</b><i style={{width:"75%"}} /></div>
              </div>
              <div className="improve-chip">✨ Improve to 90+</div>
            </article>
            <article className="sana-feature">
              <div className="sana-feature-head"><span className="sana-icon">↗</span><span>03 · TEAM MATCH</span></div>
              <h3>Put the right teams in front of the business.</h3>
              <p>Recommendations explain the match using skills, interests and technology — while the business keeps the final choice.</p>
              <div className="match-card">
                <div><strong>AI Admission Assistant</strong><span>Open · 91/100</span></div>
                <div className="match-score"><b>94%</b><span>team match</span></div>
                <div className="match-tags"><span>Python</span><span>NLP</span><span>React</span></div>
              </div>
            </article>
          </div>
        </section>

        <section className="sana-journey section reveal" id="journey">
          <div className="section-heading compact"><div><span className="section-kicker">ONE CONTINUOUS JOURNEY</span><h2>Challenge → Team → <span>Impact.</span></h2></div><p>No dead end after publishing. The interface keeps the whole project story visible.</p></div>
          <div className="journey-track">
            <div className="journey-line" />
            <div className="journey-step"><span className="journey-dot done">✓</span><b>Draft</b><small>One business sentence</small></div>
            <div className="journey-step"><span className="journey-dot done">✓</span><b>AI Analysis</b><small>Questions + readiness</small></div>
            <div className="journey-step"><span className="journey-dot done">✓</span><b>Published</b><small>Open catalog</small></div>
            <div className="journey-step"><span className="journey-dot active">4</span><b>Team selected</b><small>Human decision</small></div>
            <div className="journey-step"><span className="journey-dot">5</span><b>Impact</b><small>KPI + milestone</small></div>
          </div>
        </section>

        <section className="sana-impact section reveal">
          <div className="impact-panel">
            <div className="impact-copy">
              <span className="section-kicker">BUSINESS IMPACT</span>
              <h2>Finish with a result,<br/><span>not just a proposal.</span></h2>
              <p>When a milestone is confirmed, AI Sana can turn the project into a measurable story: what changed, who benefited and what the team achieved.</p>
              <button className="secondary-btn" onClick={() => scrollTo("how")}>See the full journey <Arrow /></button>
            </div>
            <div className="impact-preview">
              <div className="impact-label">PROJECT IMPACT · DEMO</div>
              <strong>AI Admission Assistant</strong>
              <div className="impact-before-after"><div><small>BEFORE</small><b>87%</b><span>repeated questions</span></div><div className="impact-arrow">↓ 37%</div><div><small>AFTER</small><b>50%</b><span>repeated questions</span></div></div>
              <div className="impact-stats"><span><b>18h</b> saved / month</span><span><b>+20</b> team points</span><span><b>2.4k</b> students affected</span></div>
            </div>
          </div>
        </section>

        <section className="workflow section reveal" id="how">
          <div className="section-heading compact"><div><span className="section-kicker">HOW IT WORKS</span><h2>From problem to <span>action.</span></h2></div></div>
          <div className="steps stagger">
            {[
              ["01","Describe","Business explains the problem in plain language."],
              ["02","Clarify","AI asks at least three questions and builds the card."],
              ["03","Confirm","Business edits, validates and publishes the challenge."],
              ["04","Build","Teams submit solutions. Business chooses manually."]
            ].map(([n,title,text]) => <div className="step" key={n}><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div></div>)}
          </div>
        </section>

        <section className="explore section reveal" id="explore">
          <div className="section-heading compact"><div><span className="section-kicker">LIVE CATALOG</span><h2>Find a challenge <span>worth building.</span></h2></div><p>Every published challenge stays human-confirmed. Recommendations help teams discover where their skills fit.</p></div>
          <div className="catalog-showcase">
            <div className="catalog-toolbar"><span>Recommended for your team</span><div><button className="catalog-chip active">All</button><button className="catalog-chip">AI</button><button className="catalog-chip">Web</button><button className="catalog-chip">Data</button></div></div>
            <div className="catalog-card-main">
              <div className="catalog-main-content"><div className="catalog-meta"><span className="topic">EDUCATION · AI</span><span className="ready-pill">91 · PRIORITY</span></div><h3>AI assistant for repetitive admission questions</h3><p>Build a practical solution that helps applicants get consistent answers while reducing repetitive work for staff.</p><div className="catalog-tags"><span>Python</span><span>NLP</span><span>React</span><span>4 weeks</span></div></div>
              <div className="catalog-match"><small>YOUR TEAM MATCH</small><strong>94%</strong><span>4 skills matched</span><button className="primary-btn" onClick={() => { window.location.hash = "/team"; }}>View challenge <Arrow /></button></div>
            </div>
            <div className="catalog-footer"><span>👥 3 proposals</span><span>🟢 Open</span><span>Human selection</span><span>AI recommendation</span></div>
          </div>
        </section>

        <section className="create-section reveal" id="create">
          <div className="create-card">
            <div className="eyebrow"><span className="pulse" /> {role === "business" ? "Business mode" : "Team mode"}</div>
            <h2>{role === "business" ? "Have a real problem?" : "Ready to build something real?"}</h2>
            <p>{role === "business" ? "Start with one sentence. AI SANA will help turn it into a challenge your team can actually publish." : "Explore verified business challenges and submit your solution with your team."}</p>
            <button className="primary-btn" onClick={role === "business" ? openBuilder : () => scrollTo("explore")}>{role === "business" ? "Start with AI" : "Explore challenges"} <Arrow /></button>
          </div>
        </section>
      </main>

      <footer><span>AI SANA</span><small>AI-powered challenge builder · HackAlem AI</small></footer>

      {builderOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBuilder(); }}>
        <section className="builder-modal" role="dialog" aria-modal="true" aria-labelledby="builder-title">
          <div className="builder-top"><div><span className="section-kicker">AI CHALLENGE BUILDER</span><h2 id="builder-title">Build a publishable challenge</h2></div><button className="close-btn" onClick={closeBuilder} aria-label="Close">×</button></div>
          <div className="progress"><span style={{ width: ((step - 1) / 3 * 100) + "%" }} /></div>
          <div className="builder-steps">{["Черновик","Уточнение","Тест-драйв","Публикация"].map((label,index) => <span className={step >= index + 1 ? "done" : ""} key={label}>{index + 1}. {label}</span>)}</div>

          {publishedId ? <div className="builder-body confirm-page"><div className="success-icon"><Check /></div><h3>Задача опубликована</h3><p>Карточка #{publishedId} сохранена в каталоге с рейтингом {liveScore?.total ?? 0}/100.</p><div className="publish-links"><button className="primary-btn" onClick={() => { setBuilderOpen(false); go(`/business/${publishedId}`); }}>Открыть в кабинете <Arrow /></button><button className="secondary-btn" onClick={() => { setBuilderOpen(false); go("/team"); }}>Перейти в каталог</button></div></div> : <>
            {step === 1 && <div className="builder-body"><span className="step-label">ШАГ 1</span><h3>Какую задачу должна решить команда?</h3><p>Опишите проблему своими словами. Черновик отправится в API анализа; неподтверждённые сведения не будут автоматически добавлены в карточку.</p><textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Например: сотрудники вручную проверяют счета, из-за этого обработка занимает много времени…" autoFocus /><div className="hint">Укажите, что происходит сейчас, кому мешает проблема и какого результата ждёте. <button type="button" className="link-btn" onClick={fillExample}>Подставить пример</button></div></div>}

            {step === 2 && <div className="builder-body"><span className="step-label">ШАГ 2 · {analysis?.mode === "mock" ? "РЕЖИМ ЗАГЛУШКИ" : "ИИ-АНАЛИЗ"}</span><h3>Уточните важные детали</h3><p>Вопросы и потенциальные баллы рассчитаны сервером по текущей карточке.</p>{analysis?.questions.map((q) => <label className="question" key={q.field}><span>до +{q.points} баллов</span>{q.text}<input value={answers[q.field] ?? ""} onChange={(e) => setAnswers((old) => ({ ...old, [q.field]: e.target.value }))} placeholder="Ответ…" /></label>)}</div>}

            {step === 3 && <div className="builder-body"><span className="step-label">ШАГ 3 · ТЕСТ-ДРАЙВ · {built?.mode === "mock" ? "ЗАГЛУШКА" : "ИИ"}</span><h3>Проверьте карточку на реализуемость</h3><p>Поля можно редактировать. Источники показаны рядом; после правок сервер пересчитает рейтинг и проверки.</p><div className="business-card-fields">{CARD_FIELDS.map((field) => { const hint = liveScore?.hints.find((item) => item.field === field); return <label className={`business-card-field ${hint ? "needs-improvement" : ""} ${field === "need" || field === "expected_result" || field === "success_criteria" ? "priority-field" : ""}`} key={field}><span className="field-heading"><b>{FIELD_LABELS[field]}</b>{hint && <em>Можно улучшить <strong>+{hint.gain}</strong></em>}</span><textarea rows={1} value={card[field]} onChange={(e) => { setCard((old) => ({ ...old, [field]: e.target.value })); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }} onFocus={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }} />{hint && <span className="field-improvement"><b>Как улучшить</b>{hint.text}</span>}{built?.sources[field] && <small>{card[field] === built.card[field] ? `Источник: «${built.sources[field]}»` : "Изменено вручную · исходная цитата больше не подтверждает это значение"}</small>}</label>; })}</div>
              <div className="test-drive-panel"><div className="test-drive-heading"><strong>Результат тест-драйва</strong><span>{testDrive?.passed ? "Базовые проверки пройдены" : "Нужны уточнения"}</span></div>{testDrive?.findings.length ? testDrive.findings.map((finding) => <article className={`test-drive-finding severity-${finding.severity}`} key={finding.key}><b>{finding.title}</b><p>{finding.detail}</p><small>Поле: {FIELD_LABELS[finding.field]} · Что уточнить: {finding.suggestion}</small></article>) : <p>{testDrive ? "Критичных пробелов по текущим проверкам не найдено." : "Проверяем карточку…"}</p>}</div>
              <div className="live-score"><strong>{liveScore ? `${liveScore.total}/100 · ${liveScore.level_label}` : "Пересчёт рейтинга…"}</strong>{liveScore?.breakdown.map((item) => <div key={item.key}><span>{item.label}</span><b>{item.points}/{item.weight}</b></div>)}</div>
            </div>}

            {step === 4 && <div className="builder-body confirm-page"><div className="success-icon"><Check /></div><span className="step-label">ШАГ 4</span><h3>Подтвердите публикацию</h3><p>После публикации задача появится в каталоге со статусом «Открыта». Текущий рейтинг: <b>{liveScore?.total ?? 0}/100</b>.</p>{testDrive?.findings.length ? <div className="publish-note">В тест-драйве осталось замечаний: {testDrive.findings.length}. Вы можете вернуться к карточке, исправить их или подтвердить публикацию с текущими данными.</div> : null}<div className="publish-meta"><label>Компания<input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={card.contact || "Название компании"} /></label><label>Тема<select value={topic} onChange={(e) => setTopic(e.target.value)}>{topics.map((t) => <option key={t}>{t}</option>)}</select></label><div className="publish-tags"><span>Навыки для команды <small>— по ним задачу рекомендуют командам</small></span><div>{TAG_SUGGESTIONS.map((t) => <button type="button" key={t} className={tags.includes(t) ? "active" : ""} onClick={() => toggleTag(t)}>{t}</button>)}</div></div></div><label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Подтверждаю, что проверил(а) карточку и готов(а) опубликовать задачу.</label></div>}
          </>}
          {error && <div className="error-note" role="alert">{error}</div>}
          {!publishedId && <div className="builder-actions">{step > 1 && <button className="secondary-btn" onClick={previousStep} disabled={busy}>Назад</button>}{step === 1 && <button className="primary-btn" disabled={!problem.trim() || busy} onClick={analyzeDraft}>{busy ? "Анализируем…" : "Проанализировать"} <Arrow /></button>}{step === 2 && <button className="primary-btn" disabled={busy} onClick={buildCard}>{busy ? "Собираем…" : "Собрать карточку"} <Arrow /></button>}{step === 3 && <button className="primary-btn" onClick={() => setStep(4)}>Перейти к публикации <Arrow /></button>}{step === 4 && <button className="primary-btn" disabled={!confirmed || busy} onClick={publish}>{busy ? "Публикуем…" : "Подтвердить и опубликовать"} <Arrow /></button>}</div>}
        </section>
      </div>}
    </div>
  );
}

export default App;
