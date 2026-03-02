export default function TacticalDecisionCenter({ decisionData, fmtNum }) {
  if (!decisionData) {
    return (
      <section className="panel tactical-decision">
        <h2>مركز القرار الذكي</h2>
        <p>اختر لاعبًا لعرض القرار الفوري المدعوم بالذكاء.</p>
      </section>
    );
  }

  const { decision, playerName } = decisionData;

  return (
    <section className="panel tactical-decision">
      <h2>مركز القرار الذكي</h2>
      <p className="muted">اللاعب: {playerName}</p>

      <article className="decision-hero">
        <h3>{decision.bestDecision.label}</h3>
        <p>{decision.aiCoachLine || decision.bestDecision.description}</p>
        <div className="decision-confidence">ثقة القرار: {fmtNum(decision.confidence)}%</div>
      </article>

      <div className="decision-impact-grid">
        <article>
          <span>خفض المخاطر المتوقع</span>
          <strong>{fmtNum(decision.projectedRiskImpact.reduction)}%</strong>
          <small>المخاطر بعد القرار: {fmtNum(decision.projectedRiskImpact.nextRisk)}</small>
        </article>
        <article>
          <span>تأثير احتمالية الفوز</span>
          <strong>{fmtNum(decision.projectedWinImpact.delta)}%</strong>
          <small>
            {fmtNum(decision.projectedWinImpact.winProbabilityNow)}% →{' '}
            {fmtNum(decision.projectedWinImpact.winProbabilityAfterDecision)}%
          </small>
        </article>
      </div>

      <h4>البدائل المقترحة</h4>
      <ul className="list clean">
        {decision.candidates.map((candidate) => (
          <li key={candidate.key}>
            <div>
              <strong>{candidate.label}</strong>
              <span>{candidate.description}</span>
            </div>
            <div className="candidate-score">
              <em>ملاءمة {fmtNum(candidate.suitability)}%</em>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
