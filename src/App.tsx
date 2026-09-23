import { useEffect, useRef, useState } from "react";

type Role = "business" | "team";

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" /></svg>
);

const Spark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>
);

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.5 3.5L16 5"/></svg>
);

function App() {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setVisible((prev) => ({ ...prev, [entry.target.id]: true }));
      });
    }, { threshold: 0.12 });
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const reveal = (id: string) => (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };
  const [role, setRole] = useState<Role>("business");

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-inner">
          <button className="logo" onClick={() => scrollTo("top")} aria-label="AI SANA home">
            <span className="logo-mark"><Spark /></span>
            <span>AI <b>SANA</b></span>
          </button>

          <nav className="nav-links">
            <button onClick={() => scrollTo("how")}>How it works</button>
            <button onClick={() => scrollTo("features")}>Features</button>
            <button onClick={() => scrollTo("explore")}>Challenges</button>
          </nav>

          <div className="nav-actions">
            <div className="role-switch" aria-label="Choose your role">
              <button className={role === "business" ? "active" : ""} onClick={() => setRole("business")}>Business</button>
              <button className={role === "team" ? "active" : ""} onClick={() => setRole("team")}>Team</button>
            </div>
            <button className="nav-cta" onClick={() => scrollTo("create")}>Create challenge <Arrow /></button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="hero">
          <div className="hero-glow glow-one" />
          <div className="hero-glow glow-two" />
          <div className="hero-content reveal reveal-left">
            <div className="eyebrow"><span className="pulse" /> AI-powered challenge builder</div><div className="hero-grid-lines" aria-hidden="true" />
            <h1>Turn business problems into <span>real challenges.</span></h1>
            <p className="hero-copy">
              AI SANA helps businesses structure a real problem, measure challenge readiness,
              and connect it with student teams ready to build solutions.
            </p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => scrollTo("create")}>Create a challenge <Arrow /></button>
              <button className="secondary-btn" onClick={() => scrollTo("explore")}>Explore challenges</button>
            </div>
            <div className="trust-row">
              <div className="avatars"><span>AS</span><span>MK</span><span>DN</span><span>+</span></div>
              <div><strong>Built for real teams</strong><small>From idea → validated challenge</small></div>
            </div>
          </div>

          <div className="hero-visual float-card reveal reveal-right" aria-label="Challenge readiness preview">
            <div className="visual-top">
              <span>Challenge readiness</span>
              <span className="live-dot">● Live</span>
            </div>
            <div className="score-ring">
              <div className="ring-inner"><strong>82</strong><span>/ 100</span><small>READY</small></div>
            </div>
            <div className="score-caption"><strong>Strong challenge</strong><span>AI analysis is complete</span></div>
            <div className="field-list animated-list">
              <div><span className="check"><Check /></span><div><b>Problem</b><small>Clearly defined</small></div><em>20/20</em></div>
              <div><span className="check"><Check /></span><div><b>Target users</b><small>Evidence added</small></div><em>15/15</em></div>
              <div><span className="check"><Check /></span><div><b>Success metric</b><small>Needs refinement</small></div><em>12/20</em></div>
              <div><span className="check muted"><Check /></span><div><b>Data & constraints</b><small>Partially filled</small></div><em>8/15</em></div>
            </div>
            <button className="mini-btn" onClick={() => scrollTo("create")}>Improve score <Arrow /></button>
          </div>
        </section>

        <section className="stats reveal" ref={reveal("stats")} id="stats">
          <div><strong>10</strong><span>structured fields</span></div>
          <div><strong>0–100</strong><span>readiness score</span></div>
          <div><strong>3+</strong><span>AI clarification questions</span></div>
          <div><strong>1</strong><span>real path to a team</span></div>
        </section>

        <section className="section reveal" ref={reveal("features")} id="features">
          <div className="section-heading">
            <div><span className="section-kicker">WHY AI SANA</span><h2>Less vague ideas.<br/><span>More buildable challenges.</span></h2></div>
            <p>The platform turns an unstructured business problem into a transparent, human-confirmed challenge card.</p>
          </div>
          <div className="feature-grid stagger">
            <article className="feature-card featured">
              <div className="feature-icon"><Spark /></div>
              <span>01</span><h3>AI clarification</h3>
              <p>AI asks focused questions before the challenge becomes publishable. Every answer is grounded in what the business provides.</p>
              <div className="feature-tag">No invented facts</div>
            </article>
            <article className="feature-card">
              <div className="feature-icon">✓</div>
              <span>02</span><h3>Readiness score</h3>
              <p>See exactly where points come from, what is missing, and how edits change the score.</p>
              <div className="feature-tag">Transparent 0–100</div>
            </article>
            <article className="feature-card">
              <div className="feature-icon">↗</div>
              <span>03</span><h3>Student teams</h3>
              <p>Teams discover open challenges and submit an idea, plan, deadline and project link.</p>
              <div className="feature-tag">Human selection</div>
            </article>
          </div>
        </section>

        <section className="workflow section reveal" ref={reveal("how")} id="how">
          <div className="section-heading compact">
            <div><span className="section-kicker">HOW IT WORKS</span><h2>From problem to <span>action.</span></h2></div>
          </div>
          <div className="steps stagger">
            <div className="step"><b>01</b><div><h3>Describe</h3><p>Business explains the problem in plain language.</p></div></div>
            <div className="step"><b>02</b><div><h3>Clarify</h3><p>AI asks at least three questions and builds the card.</p></div></div>
            <div className="step"><b>03</b><div><h3>Confirm</h3><p>Business edits, validates and publishes the challenge.</p></div></div>
            <div className="step"><b>04</b><div><h3>Build</h3><p>Teams submit solutions. Business chooses manually.</p></div></div>
          </div>
        </section>

        <section className="explore section reveal" ref={reveal("explore")} id="explore">
          <div className="explore-card">
            <div><span className="section-kicker">LIVE CATALOG</span><h2>Find a challenge worth building.</h2><p>Browse by topic, readiness and status. Every published challenge is confirmed by its business owner.</p></div>
            <div className="challenge-preview">
              <span className="topic">FINTECH</span><strong>Reduce time spent on manual invoice checks</strong><div><span>Readiness <b>91</b></span><span>Open for teams</span></div>
            </div>
          </div>
        </section>

        <section className="create-section reveal" ref={reveal("create")} id="create">
          <div className="create-card">
            <div className="eyebrow"><span className="pulse" /> {role === "business" ? "Business mode" : "Team mode"}</div>
            <h2>{role === "business" ? "Have a real problem?" : "Ready to build something real?"}</h2>
            <p>{role === "business" ? "Start with one sentence. AI SANA will help turn it into a challenge your team can actually publish." : "Explore verified business challenges and submit your solution with your team."}</p>
            <button className="primary-btn">{role === "business" ? "Start with AI" : "Explore challenges"} <Arrow /></button>
          </div>
        </section>
      </main>

      <footer><span>AI SANA</span><small>AI-powered challenge builder · HackAlem AI</small></footer>
    </div>
  );
}

export default App;