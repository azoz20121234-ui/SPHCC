import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

export default function PlayerDigitalTwin() {
  const { id } = useParams();
  const { players, metricsByPlayer } = useSimulation();

  const profile = useMemo(() => {
    const playerId = Number(id);
    const player = players.find((item) => item.id === playerId) || players[0];
    const metric = metricsByPlayer[player.id] || null;

    return {
      player,
      metric
    };
  }, [id, metricsByPlayer, players]);

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>التوأم الرقمي للاعب</h1>
        <p>ملف فسيولوجي شخصي للاعب {profile.player.name} يدعم القرار الوقائي اللحظي.</p>
      </header>

      <div className="page-grid cols-3">
        <article className="card">
          <h3>الخط الصحي الأساسي</h3>
          <div className="metric-line">
            <span className="muted">الجاهزية الأساسية</span>
            <strong>{round(profile.player.twin.baselineHealth, 1)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">الإجهاد الحالي</span>
            <strong>{round(profile.metric?.fatigueScore, 1)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">مخاطر الإصابة الحالية</span>
            <strong>{round(profile.metric?.injuryRisk, 1)}%</strong>
          </div>
        </article>

        <article className="card">
          <h3>خصائص الاستجابة</h3>
          <div className="metric-line">
            <span className="muted">سرعة التعافي</span>
            <strong>{round(profile.player.twin.recoveryRate)}</strong>
          </div>
          <div className="metric-line">
            <span className="muted">الحساسية العصبية</span>
            <strong>{round(profile.player.twin.neuralSensitivity)}</strong>
          </div>
          <div className="metric-line">
            <span className="muted">تحمل الحرارة</span>
            <strong>{round(profile.player.twin.heatTolerance)}</strong>
          </div>
        </article>

        <article className="card">
          <h3>نموذج المخاطر الشخصي</h3>
          <div className="metric-line">
            <span className="muted">المخاطر الكلية</span>
            <strong>{round(profile.metric?.overallRisk, 1)}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">زمن العتبة الحرجة</span>
            <strong>{Math.max(0, Math.round(profile.metric?.countdownToThreshold || 0))} ث</strong>
          </div>
          <p className="muted">هذا النموذج يتحدث كل ثانية بناءً على محركات المحاكاة داخل المتصفح.</p>
        </article>
      </div>
    </section>
  );
}
