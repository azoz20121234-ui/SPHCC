import { useSimulation } from '../utils/SimulationContext.jsx';

function formatCountdown(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

export default function Overview() {
  const { selectedMetric, selectedPlayer, teamReadiness } = useSimulation();

  const countdown = selectedMetric?.countdownToThreshold ?? Infinity;
  const risk = selectedMetric?.overallRisk ?? 0;
  const confidence = selectedMetric?.aiDecision?.confidence ?? 0;
  const exposure = selectedMetric?.financialExposure?.expectedCost30Days ?? 0;

  const countdownTone = countdown < 120 ? 'danger' : countdown < 300 ? 'warning' : 'normal';

  const ringRadius = 54;
  const ringLength = 2 * Math.PI * ringRadius;
  const ringOffset = ringLength - (Math.min(100, risk) / 100) * ringLength;

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>نظرة عامة</h1>
        <p>لوحة تنفيذية فورية مبنية بالكامل على محاكاة داخل المتصفح.</p>
      </header>

      <article className="card countdown-hero">
        <span className="muted">الوقت المتبقي قبل العتبة الحرجة</span>
        <strong className={`countdown-number ${countdownTone} number`}>
          {formatCountdown(countdown)}
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
            <div className="risk-ring-value number">{round(risk)}%</div>
          </div>
          <p className="muted">تصاعد الخطر: {round(selectedMetric?.escalationRate, 3)} /ث</p>
        </article>

        <article className="card">
          <h3>رؤية الذكاء الاصطناعي</h3>
          <p>{selectedMetric?.aiDecision?.aiCoachLine || 'جاري تحليل التوصية...'}</p>
          <div className="metric-line">
            <span className="muted">ثقة القرار</span>
            <strong className="number">{confidence}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">جاهزية الفريق</span>
            <strong className="number">{teamReadiness.toFixed(1)}%</strong>
          </div>
        </article>

        <article className="card">
          <h3>التعرض المالي</h3>
          <div className="kpi-number number">ر.س {Math.round(exposure).toLocaleString('ar-SA')}</div>
          <p className="muted">التكلفة المتوقعة خلال 30 يومًا.</p>
          <div className="metric-line">
            <span className="muted">اللاعب النشط</span>
            <strong className="number">{selectedPlayer?.name}</strong>
          </div>
        </article>
      </div>
    </section>
  );
}
