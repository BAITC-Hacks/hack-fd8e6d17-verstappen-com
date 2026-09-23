import { useEffect, useMemo, useState } from "react";

type Role = "business" | "team";
type BuilderStep = 1 | 2 | 3 | 4 | 5;

const Arrow = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>;
const Check = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.5 3.5L16 5" /></svg>;

const fields = [
  ["Problem", 15], ["Target users", 10], ["Business context", 10], ["Desired outcome", 10],
  ["Success metric", 15], ["Data available", 10], ["Constraints", 10], ["Timeline", 10],
  ["Skills needed", 5], ["Contact / owner", 5]
] as const;

function App() {
  const [role, setRole] = useState<Role>("business");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [step, setStep] = useState<BuilderStep>(1);
  const [problem, setProblem] = useState("");
  const [answers, setAnswers] = useState(["", "", ""]);
  const [confirmed, setConfirmed] = useState(false);

  const score = useMemo(() => {
    const base = problem.trim() ? 20 : 0;
    const q = answers.filter(Boolean).length * 10;
    return Math.min(100, base + q + (confirmed ? 50 : 0));
  }, [problem, answers, confirmed]);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openBuilder = () => {
    setRole("business");
    setBuilderOpen(true);
    setStep(1);
  };

  const closeBuilder = () => setBuilderOpen(false);

  const nextStep = () => {
    if (step === 1 && !problem.trim()) return;
    setStep((value) => Math.min(5, value + 1) as BuilderStep);
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
              <button className={role === "business" ? "active" : ""} onClick={() => setRole("business")}>Business</button>
              <button className={role === "team" ? "active" : ""} onClick={() => setRole("team")}>Team</button>
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

        <section className="section reveal" id="features">
          <div className="section-heading"><div><span className="section-kicker">WHY AI SANA</span><h2>Less vague ideas.<br/><span>More buildable challenges.</span></h2></div><p>The platform turns an unstructured business problem into a transparent, human-confirmed challenge card.</p></div>
          <div className="feature-grid stagger">
            <article className="feature-card featured"><div className="feature-icon"><Spark /></div><span>01</span><h3>AI clarification</h3><p>AI asks focused questions before the challenge becomes publishable. Every answer is grounded in what the business provides.</p><div className="feature-tag">No invented facts</div></article>
            <article className="feature-card"><div className="feature-icon">✓</div><span>02</span><h3>Readiness score</h3><p>See exactly where points come from, what is missing, and how edits change the score.</p><div className="feature-tag">Transparent 0–100</div></article>
            <article className="feature-card"><div className="feature-icon">↗</div><span>03</span><h3>Student teams</h3><p>Teams discover open challenges and submit an idea, plan, deadline and project link.</p><div className="feature-tag">Human selection</div></article>
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
          <div className="explore-card">
            <div><span className="section-kicker">LIVE CATALOG</span><h2>Find a challenge worth building.</h2><p>Browse by topic, readiness and status. Every published challenge is confirmed by its business owner.</p><button className="secondary-btn catalog-btn">Open catalog <Arrow /></button></div>
            <div className="challenge-preview"><span className="topic">FINTECH</span><strong>Reduce time spent on manual invoice checks</strong><div><span>Readiness <b>91</b></span><span>Open for teams</span></div></div>
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
          <div className="progress"><span style={{ width: ((step - 1) / 4 * 100) + "%" }} /></div>
          <div className="builder-steps">{["Problem","Clarify","Challenge Card","Score","Confirm"].map((label,index) => <span className={step >= index + 1 ? "done" : ""} key={label}>{index + 1}. {label}</span>)}</div>

          {step === 1 && <div className="builder-body"><span className="step-label">STEP 1</span><h3>What real problem should students solve?</h3><p>Describe it in your own words. AI will ask follow-up questions instead of guessing missing facts.</p><textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Example: Our team spends too much time checking invoices manually..." autoFocus /><div className="hint">Tip: mention who has the problem and what takes too much time.</div></div>}

          {step === 2 && <div className="builder-body"><span className="step-label">STEP 2</span><h3>AI clarification</h3><p>Answer at least three focused questions. Each answer improves the challenge.</p>{["Who are the target users or employees affected?","What result would make this solution successful?","What data, tools or constraints should the team know?"].map((q,index) => <label className="question" key={q}><span>+10 points</span>{q}<input value={answers[index]} onChange={(e) => setAnswers((old) => old.map((v,i) => i === index ? e.target.value : v))} placeholder="Your answer..." /></label>)}</div>}

          {step === 3 && <div className="builder-body"><span className="step-label">STEP 3</span><h3>Challenge Card</h3><p>AI has structured your answers. Review the key fields before scoring.</p><div className="card-grid"><div><small>PROBLEM</small><strong>{problem || "Not provided"}</strong></div><div><small>TARGET USERS</small><strong>{answers[0] || "Not provided"}</strong></div><div><small>SUCCESS METRIC</small><strong>{answers[1] || "Not provided"}</strong></div><div><small>DATA & CONSTRAINTS</small><strong>{answers[2] || "Not provided"}</strong></div></div><div className="source-note"><Check /> Source: answers provided by business · AI does not invent facts</div></div>}

          {step === 4 && <div className="builder-body score-page"><span className="step-label">STEP 4</span><h3>Challenge readiness</h3><div className="big-score"><strong>{score}</strong><span>/100</span></div><p>{score >= 70 ? "Ready for final confirmation. The core problem and clarification answers are present." : "Add clarification answers to increase readiness."}</p><div className="score-breakdown">{fields.slice(0,5).map(([name,points],index) => <div key={name}><span>{name}</span><b>{index === 0 && problem ? points : index > 0 && answers[index - 1] ? points : 0}/{points}</b></div>)}</div></div>}

          {step === 5 && <div className="builder-body confirm-page"><div className="success-icon"><Check /></div><span className="step-label">STEP 5</span><h3>Human confirmation</h3><p>Review the card, then confirm it before publication. Business owners keep control of what becomes public.</p><label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm that the challenge information is accurate.</label><div className="publish-note">AI can structure and explain the information, but it does not choose winners or publish without confirmation.</div></div>}

          <div className="builder-actions">{step > 1 && <button className="secondary-btn" onClick={previousStep}>Back</button>}<button className="primary-btn" disabled={(step === 1 && !problem.trim()) || (step === 5 && !confirmed)} onClick={step === 5 ? closeBuilder : nextStep}>{step === 5 ? "Publish challenge" : "Continue"} <Arrow /></button></div>
        </section>
      </div>}
    </div>
  );
}

export default App;
