export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="section-container">
        <div className="section-label">How It Works</div>
        <h2 className="section-title">Three Simple Steps</h2>

        <div className="steps-grid">
          <div className="step-card step-light">
            <div className="step-number">01</div>
            <h3>Paste a GitHub PR URL</h3>
            <p>Drop in any public pull request link — the agent reads the diff, metadata, and changed files automatically.</p>
          </div>

          <div className="step-card step-arrow">
            <span className="arrow-icon">→</span>
          </div>

          <div className="step-card step-dark">
            <div className="step-number">02</div>
            <h3>AI Reads Every Changed File</h3>
            <p>The agent iteratively fetches code, follows imports, and understands context across the entire PR.</p>
          </div>

          <div className="step-card step-arrow">
            <span className="arrow-icon">→</span>
          </div>

          <div className="step-card step-accent">
            <div className="step-number">03</div>
            <h3>Get Structured Findings</h3>
            <p>Receive bugs, security issues, conflict analysis, and a ready-to-use AI prompt — all in one dashboard.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
