import { useMemo } from 'react';
import SeasonFatigueCurve from '../components/SeasonFatigueCurve.jsx';
import SeasonInjuryMap from '../components/SeasonInjuryMap.jsx';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function SeasonForecast() {
  const { selectedHistory } = useSimulation();

  const season = useMemo(() => {
    const baseFatigue = Number(selectedHistory[0]?.fatigueScore || 52);
    const baseRisk = Number(selectedHistory[0]?.overallRisk || 48);

    const games = Array.from({ length: 20 }).map((_, index) => {
      const match = index + 1;
      const fatigue = Math.min(100, baseFatigue + index * 1.8 + Math.sin((index + 1) / 2.4) * 4);
      const injuryProbability = Math.min(100, baseRisk + index * 1.4 + Math.cos((index + 1) / 2.2) * 3);
      const recoveryWindow = Math.max(1, Math.round(3 - Math.sin((index + 1) / 3.5)));
      return {
        match,
        fatigue: round(fatigue),
        injuryProbability: round(injuryProbability),
        recoveryWindow
      };
    });

    const peak = [...games].sort((a, b) => b.fatigue - a.fatigue).slice(0, 3);
    const restWindows = games
      .filter((item) => item.injuryProbability >= 70)
      .slice(0, 5)
      .map((item) => `مباراة ${item.match} - راحة ${item.recoveryWindow} يوم`);

    return {
      games,
      peak,
      averageFatigue: round(average(games.map((item) => item.fatigue))),
      averageInjuryProbability: round(average(games.map((item) => item.injuryProbability))),
      restWindows
    };
  }, [selectedHistory]);

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>توقع الموسم</h1>
        <p>محاكاة 20 مباراة لاكتشاف ذروة الإجهاد ونوافذ الراحة المثلى.</p>
      </header>

      <div className="season-grid">
        <article className="card">
          <h3>منحنى الإجهاد</h3>
          <div className="metric-line">
            <span className="muted">متوسط الإجهاد الموسمي</span>
            <strong>{season.averageFatigue}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">ذروة الإجهاد</span>
            <strong>{season.peak[0]?.fatigue || 0}%</strong>
          </div>
          <ul className="plain-list">
            {season.peak.map((item) => (
              <li key={item.match}>مباراة {item.match}: إجهاد {item.fatigue}%</li>
            ))}
          </ul>
          <SeasonFatigueCurve games={season.games} />
        </article>

        <article className="card">
          <h3>خريطة احتمالية الإصابة</h3>
          <div className="metric-line">
            <span className="muted">متوسط احتمالية الإصابة</span>
            <strong>{season.averageInjuryProbability}%</strong>
          </div>
          <div className="metric-line">
            <span className="muted">أعلى مخاطرة متوقعة</span>
            <strong>{Math.max(...season.games.map((item) => item.injuryProbability))}%</strong>
          </div>
          <p className="muted">ترتفع المخاطر تدريجيًا مع تراكم الحمل في النصف الثاني من الموسم.</p>
          <SeasonInjuryMap games={season.games} />
        </article>

        <article className="card">
          <h3>نوافذ الراحة الموصى بها</h3>
          {season.restWindows.length > 0 ? (
            <ul className="plain-list">
              {season.restWindows.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">لا توجد نوافذ حرجة حاليًا، الخطة تحت السيطرة.</p>
          )}
        </article>
      </div>
    </section>
  );
}
