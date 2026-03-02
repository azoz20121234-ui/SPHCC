export default function AIExplainabilityPanel({ snapshot }) {
  const contributions = snapshot?.contributions || [];
  const sensitivity = snapshot?.sensitivity || [];
  const narrative = snapshot?.narrative || [];

  return (
    <section className="card ai-explainability">
      <h3>تحليل الحساسية المتقدم</h3>

      <div className="explain-grid">
        <article>
          <h4>تأثير العوامل على القرار</h4>
          <div className="breakdown-list">
            {contributions.map((item) => (
              <div key={item.key} className="breakdown-item">
                <div className="metric-line">
                  <span>{item.label}</span>
                  <strong>{item.share}%</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, item.share)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h4>سيناريو +10% لكل عامل</h4>
          <div className="explain-table">
            {sensitivity.map((item) => (
              <div key={item.key} className="explain-row">
                <strong>{item.label}</strong>
                <span>+مخاطر: {item.deltaRisk}%</span>
                <span>تغير الفوز: {item.deltaWin}%</span>
                <span>مخاطر متوقعة: {item.riskIfUp10}%</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="explain-notes">
        <h4>لماذا هذه التوصية؟</h4>
        <ul className="plain-list">
          {narrative.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
