import { useMemo } from 'react';
import AIExplainabilityPanel from '../components/AIExplainabilityPanel.jsx';
import { buildExplainabilitySnapshot } from '../engine/explainabilityEngine.js';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

export default function AIIntelligence() {
  const { selectedMetric, selectedPlayer } = useSimulation();

  const explainability = useMemo(
    () => buildExplainabilitySnapshot(selectedMetric, selectedPlayer?.twin, selectedMetric?.aiDecision),
    [selectedMetric, selectedPlayer?.twin]
  );

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>ذكاء القرار</h1>
        <p>تفكيك القرار التنبؤي وشرح العوامل الأكثر تأثيرًا على التوصية.</p>
      </header>

      <div className="page-grid cols-3">
        <article className="card">
          <h3>تفكيك المخاطر</h3>
          <div className="breakdown-list">
            {explainability.contributions.map((item) => (
              <div key={item.key} className="breakdown-item">
                <div className="metric-line">
                  <span>{item.label}</span>
                  <strong>{round(item.share)}%</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, item.share)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>درجة الثقة</h3>
          <div className="kpi-number number">{round(selectedMetric?.aiDecision?.confidence)}%</div>
          <p className="muted">يقين النموذج في القرار الحالي.</p>
          <div className="metric-line">
            <span className="muted">فرق احتمالية الفوز</span>
            <strong>{round(selectedMetric?.aiDecision?.projectedWinImpact?.delta)}%</strong>
          </div>
        </article>

        <article className="card">
          <h3>سبب التوصية</h3>
          <p>{selectedMetric?.aiDecision?.aiCoachLine || 'جاري تجهيز التوصية...'}</p>
          <h4 className="muted">عوامل الحساسية</h4>
          <ul className="plain-list">
            <li>سرعة التعافي: {round(selectedPlayer?.twin?.recoveryRate, 2)}</li>
            <li>الحساسية العصبية: {round(selectedPlayer?.twin?.neuralSensitivity, 2)}</li>
            <li>تحمل الحرارة: {round(selectedPlayer?.twin?.heatTolerance, 2)}</li>
          </ul>
        </article>
      </div>

      <AIExplainabilityPanel snapshot={explainability} />
    </section>
  );
}
