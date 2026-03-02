import { useMemo } from 'react';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function contribution(value, total) {
  if (!total) return 0;
  return (value / total) * 100;
}

export default function AIIntelligence() {
  const { selectedMetric, selectedPlayer } = useSimulation();

  const breakdown = useMemo(() => {
    if (!selectedMetric) {
      return [];
    }

    const fatigue = selectedMetric.fatigueScore * 0.4;
    const neural = selectedMetric.neuralLoad * 0.3;
    const heat = selectedMetric.heatStress * 0.2;
    const hydrationPenalty = (100 - selectedMetric.hydration) * 0.1;
    const total = fatigue + neural + heat + hydrationPenalty;

    return [
      { key: 'fatigue', label: 'الإجهاد', value: contribution(fatigue, total) },
      { key: 'neural', label: 'الحمل العصبي', value: contribution(neural, total) },
      { key: 'heat', label: 'الإجهاد الحراري', value: contribution(heat, total) },
      { key: 'hydration', label: 'نقص الترطيب', value: contribution(hydrationPenalty, total) }
    ];
  }, [selectedMetric]);

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
            {breakdown.map((item) => (
              <div key={item.key} className="breakdown-item">
                <div className="metric-line">
                  <span>{item.label}</span>
                  <strong>{round(item.value)}%</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, item.value)}%` }} />
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
    </section>
  );
}
