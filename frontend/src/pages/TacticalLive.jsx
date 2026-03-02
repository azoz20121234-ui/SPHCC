import { useMemo, useState } from 'react';
import CountdownToBreakdown from '../components/CountdownToBreakdown.jsx';
import HeatMapComponent from '../components/HeatMapComponent.jsx';
import TacticalScenarioBoard from '../components/TacticalScenarioBoard.jsx';
import TimelineProjection from '../components/TimelineProjection.jsx';
import { buildDecisionScenarios } from '../engine/decisionScenarioEngine.js';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

export default function TacticalLive() {
  const { selectedMetric } = useSimulation();
  const [loadCut, setLoadCut] = useState(18);

  const decisionData = useMemo(() => {
    if (!selectedMetric) return null;
    return {
      playerName: selectedMetric.playerName,
      decision: selectedMetric.aiDecision
    };
  }, [selectedMetric]);

  const substitutionSimulation = useMemo(() => {
    if (!selectedMetric) {
      return {
        projectedRisk: 0,
        projectedWin: 0
      };
    }

    const reduction = (Number(loadCut) / 100) * 22;
    const projectedRisk = Math.max(0, selectedMetric.overallRisk - reduction);
    const projectedWin = Math.min(95, selectedMetric.impact.continueWinProbability + reduction * 0.18);

    return {
      projectedRisk: round(projectedRisk),
      projectedWin: round(projectedWin)
    };
  }, [loadCut, selectedMetric]);

  const decisionScenarios = useMemo(() => buildDecisionScenarios(selectedMetric), [selectedMetric]);

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>البث التكتيكي المباشر</h1>
        <p>مراقبة لحظية للمخاطر وخيارات التبديل الوقائي داخل المباراة.</p>
      </header>

      <div className="tactical-grid">
        <TimelineProjection selectedMetric={selectedMetric} />

        <article className="card">
          <h3>القياسات الحية</h3>
          <div className="metric-line">
            <span className="muted">نبض القلب</span>
            <strong>{round(selectedMetric?.heartRate)} نبضة/د</strong>
          </div>
          <div className="metric-line">
            <span className="muted">الإجهاد البدني</span>
            <strong>{round(selectedMetric?.fatigueScore)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">مخاطر الإصابة</span>
            <strong>{round(selectedMetric?.injuryRisk)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">مخاطر الترطيب</span>
            <strong>{round(selectedMetric?.hydrationRisk)}%</strong>
          </div>
        </article>
      </div>

      <div className="tactical-grid">
        <HeatMapComponent selectedMetric={selectedMetric} decisionData={decisionData} />

        <article className="card">
          <h3>محاكي التبديل</h3>
          <p className="muted">اخفض الحمل البدني وشاهد الأثر المتوقع فورًا.</p>
          <label htmlFor="loadCut">نسبة خفض الحمل: {loadCut}%</label>
          <input
            id="loadCut"
            type="range"
            min="0"
            max="40"
            value={loadCut}
            onChange={(event) => setLoadCut(Number(event.target.value))}
          />
          <div className="metric-line">
            <span className="muted">المخاطر بعد التدخل</span>
            <strong>{substitutionSimulation.projectedRisk}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">احتمالية الفوز</span>
            <strong>{substitutionSimulation.projectedWin}%</strong>
          </div>
        </article>
      </div>

      <TacticalScenarioBoard scenarios={decisionScenarios} />

      <CountdownToBreakdown
        selectedMetric={selectedMetric}
        decisionData={decisionData}
        matchImpact={selectedMetric?.matchImpact}
      />
    </section>
  );
}
