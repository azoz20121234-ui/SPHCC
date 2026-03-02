export default function Overview() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>Overview</h1>
        <p>Executive overview of simulation health intelligence.</p>
      </header>

      <div className="page-grid cols-3">
        <article className="card kpi-card-large">
          <span>Countdown to Critical Zone</span>
          <strong>07:42</strong>
        </article>
        <article className="card">
          <h3>Risk Index</h3>
          <p>Composite readiness and exposure snapshot.</p>
        </article>
        <article className="card">
          <h3>AI Insight</h3>
          <p>Preventive substitution recommended with high confidence.</p>
        </article>
      </div>
    </section>
  );
}
