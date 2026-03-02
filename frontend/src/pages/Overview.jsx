import { useEffect, useMemo, useRef, useState } from 'react';
import { startTelemetry } from '../engine/telemetryEngine.js';
import { calculateRiskSnapshot } from '../engine/riskEngine.js';
import { calculateImpact } from '../engine/impactEngine.js';
import { generateAiDecision } from '../engine/aiEngine.js';

function formatCountdown(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function round(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

export default function Overview() {
  const [telemetry, setTelemetry] = useState({
    fatigue: 40,
    neuralLoad: 35,
    heatStress: 30,
    hydration: 80,
    heartRate: 120,
    tick: 0
  });
  const [riskSnapshot, setRiskSnapshot] = useState({
    risk: 0,
    escalationRate: 0.1,
    countdownToThreshold: Infinity,
    threshold: 75
  });
  const fatigueHistoryRef = useRef([]);

  useEffect(() => {
    const stopTelemetry = startTelemetry((sample) => {
      const nextHistory = [...fatigueHistoryRef.current, Number(sample.fatigue)].slice(-5);
      fatigueHistoryRef.current = nextHistory;

      const snapshot = calculateRiskSnapshot(sample, nextHistory, 75);
      setTelemetry(sample);
      setRiskSnapshot(snapshot);
    });

    return () => {
      stopTelemetry();
    };
  }, []);

  const impact = useMemo(() => calculateImpact(riskSnapshot.risk), [riskSnapshot.risk]);
  const aiDecision = useMemo(
    () => generateAiDecision({ overallRisk: riskSnapshot.risk }),
    [riskSnapshot.risk]
  );

  const teamReadiness = useMemo(() => round(Math.max(0, 100 - riskSnapshot.risk * 0.85)), [riskSnapshot.risk]);
  const countdownTone =
    riskSnapshot.countdownToThreshold < 120
      ? 'danger'
      : riskSnapshot.countdownToThreshold < 300
        ? 'warning'
        : 'normal';

  const ringRadius = 54;
  const ringLength = 2 * Math.PI * ringRadius;
  const ringOffset = ringLength - (Math.min(100, riskSnapshot.risk) / 100) * ringLength;

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>نظرة عامة</h1>
        <p>لوحة تنفيذية فورية مبنية بالكامل على محاكاة داخل المتصفح.</p>
      </header>

      <article className="card countdown-hero">
        <span className="muted">الوقت المتبقي قبل العتبة الحرجة</span>
        <strong className={`countdown-number ${countdownTone} number`}>
          {formatCountdown(riskSnapshot.countdownToThreshold)}
        </strong>
      </article>

      <div className="overview-grid">
        <article className="card">
          <h3>مؤشر المخاطر</h3>
          <div className="risk-ring-wrap">
            <svg className="risk-ring" viewBox="0 0 140 140" aria-label="مؤشر المخاطر">
              <circle cx="70" cy="70" r={ringRadius} className="risk-ring-base" />
              <circle
                cx="70"
                cy="70"
                r={ringRadius}
                className="risk-ring-progress"
                strokeDasharray={ringLength}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="risk-ring-value number">{round(riskSnapshot.risk)}%</div>
          </div>
          <p className="muted">معدل التصاعد: {round(riskSnapshot.escalationRate, 3)} /ث</p>
        </article>

        <article className="card">
          <h3>رؤية الذكاء الاصطناعي</h3>
          <p>{aiDecision.aiCoachLine}</p>
          <div className="metric-line">
            <span className="muted">الثقة</span>
            <strong className="number">{aiDecision.confidence}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">جاهزية الفريق</span>
            <strong className="number">{teamReadiness}%</strong>
          </div>
        </article>

        <article className="card">
          <h3>التعرض المالي</h3>
          <div className="kpi-number number">SAR {impact.financialExposure.toLocaleString('en-US')}</div>
          <p className="muted">تقدير فوري لتكلفة المخاطر الحالية.</p>
          <div className="metric-line">
            <span className="muted">احتمالية الإصابة</span>
            <strong className="number">{round(impact.injuryProbability * 100)}%</strong>
          </div>
        </article>
      </div>

      <div className="page-grid">
        <article className="card">
          <h3>القياسات الحية</h3>
          <div className="metric-line">
            <span className="muted">Fatigue</span>
            <strong className="number">{round(telemetry.fatigue)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">Neural Load</span>
            <strong className="number">{round(telemetry.neuralLoad)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">Heat Stress</span>
            <strong className="number">{round(telemetry.heatStress)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">Heart Rate</span>
            <strong className="number">{round(telemetry.heartRate)} bpm</strong>
          </div>
        </article>
      </div>
    </section>
  );
}
