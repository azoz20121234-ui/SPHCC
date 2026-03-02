export default function TacticalScenarioBoard({ scenarios }) {
  if (!scenarios?.length) {
    return (
      <section className="card tactical-scenarios">
        <h3>سيناريوهات القرار اللحظي</h3>
        <p className="muted">جاري حساب السيناريوهات التكتيكية.</p>
      </section>
    );
  }

  const best = scenarios[0];

  return (
    <section className="card tactical-scenarios">
      <div className="scenario-header">
        <h3>سيناريوهات القرار اللحظي</h3>
        <span className="muted">أفضل خيار الآن: {best.label}</span>
      </div>

      <div className="scenario-list">
        {scenarios.map((item, index) => (
          <article key={item.key} className={`scenario-item ${index === 0 ? 'best' : ''}`}>
            <header>
              <strong>{item.label}</strong>
              <em>ثقة {item.confidence}%</em>
            </header>
            <p className="muted">{item.summary}</p>
            <div className="scenario-metrics">
              <span>مخاطر بعد 5 د: {item.riskAfter5}%</span>
              <span>فرق المخاطر: {item.deltaRisk >= 0 ? '-' : '+'}{Math.abs(item.deltaRisk)}%</span>
              <span>فرق الفوز: {item.deltaWin >= 0 ? '+' : ''}{item.deltaWin}%</span>
              <span>تعرض مالي: ر.س {item.projectedExposure.toLocaleString('ar-SA')}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
