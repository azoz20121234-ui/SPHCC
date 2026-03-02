import { useEffect, useMemo, useState } from 'react';
import {
  clamp,
  computeNeuralLoad,
  estimateRiskEscalationPerMinute,
  formatCountdown
} from '../utils/riskMath.js';

const CRITICAL_THRESHOLD = 75;

export default function CountdownToBreakdown({ selectedMetric, decisionData, matchImpact }) {
  const [targetTimestamp, setTargetTimestamp] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const projection = useMemo(() => {
    const overallRisk = Number(selectedMetric?.overallRisk || 0);
    const directCountdown = Number(selectedMetric?.countdownToThreshold);
    const directEscalation = Number(selectedMetric?.escalationRate);
    const neuralLoad = computeNeuralLoad(selectedMetric, decisionData);
    const escalationPerMinute = Number.isFinite(directEscalation)
      ? directEscalation * 60
      : estimateRiskEscalationPerMinute(selectedMetric, neuralLoad, matchImpact);

    if (overallRisk >= CRITICAL_THRESHOLD) {
      return {
        overallRisk,
        neuralLoad,
        escalationPerMinute,
        secondsToCritical: 0
      };
    }

    const secondsToCritical = Number.isFinite(directCountdown)
      ? Math.max(0, Math.floor(directCountdown))
      : Math.max(
          0,
          Math.floor(((CRITICAL_THRESHOLD - overallRisk) / Math.max(0.2, escalationPerMinute)) * 60)
        );

    return {
      overallRisk,
      neuralLoad,
      escalationPerMinute,
      secondsToCritical
    };
  }, [decisionData, matchImpact, selectedMetric]);

  useEffect(() => {
    const nextTarget = Date.now() + projection.secondsToCritical * 1000;
    setTargetTimestamp(nextTarget);
    setRemainingSeconds(projection.secondsToCritical);
  }, [projection.secondsToCritical]);

  useEffect(() => {
    if (!targetTimestamp) {
      return undefined;
    }

    const timer = setInterval(() => {
      const next = Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
      setRemainingSeconds(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const isCritical = remainingSeconds <= 0;
  const baseWinProbability = Number(
    decisionData?.decision?.projectedWinImpact?.winProbabilityNow ||
      matchImpact?.impact?.continueFiveMinutes?.winProbability ||
      55
  );
  const droppedWinProbability = clamp(baseWinProbability - 9, 5, 90);
  const currentWinProbability = isCritical ? droppedWinProbability : baseWinProbability;
  const bestDecisionLabel = decisionData?.decision?.bestDecision?.label || 'تبديل وقائي فوري';
  const bestDecisionReason =
    decisionData?.decision?.bestDecision?.description ||
    'المؤشرات تتجه لمنطقة خطر حرجة وتتطلب تدخل مباشر.';

  return (
    <section className={`panel breakdown-panel ${isCritical ? 'critical-zone' : ''}`}>
      <div className="breakdown-header">
        <h2>Countdown to Breakdown</h2>
        <span className={`risk-zone ${isCritical ? 'danger' : 'watch'}`}>
          {isCritical ? 'Risk Zone: Critical' : 'Risk Zone: Monitor'}
        </span>
      </div>

      <div className="breakdown-count">
        <small>الوقت المتبقي قبل المنطقة الحرجة</small>
        <strong>{formatCountdown(remainingSeconds)}</strong>
      </div>

      <div className="breakdown-grid">
        <article>
          <span>المخاطر الحالية</span>
          <strong>{projection.overallRisk.toFixed(1)}%</strong>
        </article>
        <article>
          <span>Neural Load</span>
          <strong>{projection.neuralLoad.toFixed(1)}%</strong>
        </article>
        <article>
          <span>تصاعد الخطر/دقيقة</span>
          <strong>{projection.escalationPerMinute.toFixed(2)}</strong>
        </article>
        <article>
          <span>Win Probability</span>
          <strong>{currentWinProbability.toFixed(1)}%</strong>
        </article>
      </div>

      {isCritical && (
        <div className="breakdown-alert">
          <h3>توصية AI Coach الفورية</h3>
          <p>
            <b>{bestDecisionLabel}</b> - {bestDecisionReason}
          </p>
          <p>
            تم تفعيل وضع الخطر الحرج وخفض احتمالية الفوز إلى <b>{currentWinProbability.toFixed(1)}%</b>.
          </p>
        </div>
      )}
    </section>
  );
}
