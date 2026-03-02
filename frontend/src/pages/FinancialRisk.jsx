export default function FinancialRisk() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>Financial Risk</h1>
        <p>30-day exposure and substitution ROI simulation.</p>
      </header>
      <div className="page-grid cols-3">
        <article className="card"><h3>30-Day Exposure</h3><p>SAR 127,000 projected at current trajectory.</p></article>
        <article className="card"><h3>Injury Cost Projection</h3><p>Cost under stay vs substitute scenarios.</p></article>
        <article className="card"><h3>ROI of Substitution</h3><p>Net preserved value by preventive intervention.</p></article>
      </div>
    </section>
  );
}
