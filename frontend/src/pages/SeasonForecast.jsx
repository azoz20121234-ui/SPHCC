export default function SeasonForecast() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>Season Forecast</h1>
        <p>Seasonal fatigue peaks and rest windows from simulation.</p>
      </header>
      <div className="page-grid cols-3">
        <article className="card"><h3>Fatigue Curve</h3><p>Trendline across upcoming fixtures.</p></article>
        <article className="card"><h3>Injury Probability Map</h3><p>Per-match exposure estimate.</p></article>
        <article className="card"><h3>Rest Windows</h3><p>Recommended recovery slots.</p></article>
      </div>
    </section>
  );
}
