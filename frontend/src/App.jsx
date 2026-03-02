import { useEffect, useMemo, useState } from 'react';

const queryApiRoot = new URLSearchParams(window.location.search).get('api');
if (queryApiRoot) {
  localStorage.setItem('sphcc_api_root', queryApiRoot);
}

const API_ROOT =
  queryApiRoot ||
  localStorage.getItem('sphcc_api_root') ||
  import.meta.env.VITE_API_ROOT ||
  window.location.origin;

const MODES = {
  executive: 'تنفيذي',
  command: 'مركز قيادة حي',
  tactical: 'تكتيكي بالذكاء الاصطناعي'
};

function fmtNum(value) {
  return Number(value || 0).toFixed(1);
}

function fmtTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('ar-SA');
}

function gaugeClass(score) {
  if (score >= 80) return 'gauge critical';
  if (score >= 60) return 'gauge high';
  if (score >= 35) return 'gauge moderate';
  return 'gauge low';
}

export default function App() {
  const [mode, setMode] = useState('executive');
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('all');
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dashboard, setDashboard] = useState({ playersCount: 0, activeAlerts: 0, avgRisk: 0 });
  const [streamState, setStreamState] = useState('جاري الاتصال...');

  const selectedMetric = useMemo(() => {
    if (selectedPlayerId === 'all') return metrics[0] || null;
    return metrics.find((item) => String(item.playerId) === String(selectedPlayerId)) || null;
  }, [metrics, selectedPlayerId]);

  const tacticalPlan = useMemo(() => {
    if (!selectedMetric) {
      return ['لا توجد بيانات حية بعد'];
    }

    const items = [];
    if (selectedMetric.overallRisk >= 80) {
      items.push('تبديل وقائي فوري وتقليل الحمل البدني 60% خلال 10 دقائق.');
    } else if (selectedMetric.overallRisk >= 60) {
      items.push('خفض شدة الجهد إلى متوسط وإعادة تقييم المؤشرات بعد دقيقتين.');
    } else {
      items.push('استمرار الخطة الحالية مع مراقبة لحظية كل دقيقتين.');
    }

    if (selectedMetric.hydrationRisk >= 60) {
      items.push('تفعيل بروتوكول ترطيب سريع ومراجعة الحرارة المحيطة.');
    }

    if (selectedMetric.fatigueScore >= 70) {
      items.push('تقليل التسارعات القصوى وتعديل التموضع التكتيكي للاعب.');
    }

    return items;
  }, [selectedMetric]);

  async function request(path, options) {
    const res = await fetch(`${API_ROOT}${path}`, options);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Request failed');
    }
    return res.json();
  }

  async function loadSnapshot() {
    const [playersData, metricsData, alertsData, dashboardData] = await Promise.all([
      request('/api/players'),
      request(
        selectedPlayerId === 'all'
          ? '/api/metrics/latest?limit=40'
          : `/api/metrics/latest?playerId=${selectedPlayerId}&limit=40`
      ),
      request('/api/alerts?status=active&limit=30'),
      request('/api/dashboard')
    ]);

    setPlayers(playersData);
    setMetrics(metricsData);
    setAlerts(alertsData);
    setDashboard(dashboardData);
  }

  useEffect(() => {
    loadSnapshot().catch((err) => setStreamState(`فشل التحميل: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId]);

  useEffect(() => {
    const source = new EventSource(`${API_ROOT}/live`);

    source.addEventListener('connected', () => setStreamState('البث الحي متصل'));

    source.addEventListener('metric', (event) => {
      const metric = JSON.parse(event.data);
      setMetrics((prev) => {
        const next = [metric, ...prev].slice(0, 100);
        return selectedPlayerId === 'all'
          ? next
          : next.filter((item) => String(item.playerId) === String(selectedPlayerId));
      });
    });

    source.addEventListener('alert', (event) => {
      const alert = JSON.parse(event.data);
      setAlerts((prev) => [alert, ...prev].slice(0, 60));
    });

    source.addEventListener('dashboard', (event) => {
      const payload = JSON.parse(event.data);
      setDashboard(payload);
    });

    source.onerror = () => {
      setStreamState('انقطاع البث - إعادة المحاولة');
    };

    return () => source.close();
  }, [selectedPlayerId]);

  return (
    <div className={`app mode-${mode}`}>
      <header className="shell topbar">
        <div>
          <h1>منصة SPHCC</h1>
          <p>مركز القيادة التنبؤية للصحة الرياضية - بث حي من الميدان</p>
        </div>
        <span className="pill">{streamState}</span>
      </header>

      <main className="shell main-grid">
        <section className="panel controls">
          <label htmlFor="mode">وضع العرض</label>
          <div className="segmented" id="mode">
            {Object.entries(MODES).map(([key, label]) => (
              <button
                key={key}
                className={mode === key ? 'active' : ''}
                type="button"
                onClick={() => setMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <label htmlFor="player">اختيار اللاعب</label>
          <select
            id="player"
            value={selectedPlayerId}
            onChange={(event) => setSelectedPlayerId(event.target.value)}
          >
            <option value="all">كل اللاعبين</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} - {player.sport}
              </option>
            ))}
          </select>
        </section>

        <section className="panel stats">
          <article>
            <span>عدد اللاعبين</span>
            <strong>{dashboard.playersCount}</strong>
          </article>
          <article>
            <span>التنبيهات النشطة</span>
            <strong>{dashboard.activeAlerts}</strong>
          </article>
          <article>
            <span>متوسط المخاطر</span>
            <strong>{fmtNum(dashboard.avgRisk)}</strong>
          </article>
        </section>

        <section className="panel gauges">
          <h2>مؤشرات المخاطر الحية</h2>
          <div className="gauge-row">
            <div className={gaugeClass(selectedMetric?.fatigueScore || 0)}>
              <span>الإجهاد</span>
              <strong>{fmtNum(selectedMetric?.fatigueScore)}</strong>
            </div>
            <div className={gaugeClass(selectedMetric?.injuryRisk || 0)}>
              <span>خطر الإصابة</span>
              <strong>{fmtNum(selectedMetric?.injuryRisk)}</strong>
            </div>
            <div className={gaugeClass(selectedMetric?.hydrationRisk || 0)}>
              <span>خطر الجفاف</span>
              <strong>{fmtNum(selectedMetric?.hydrationRisk)}</strong>
            </div>
            <div className={gaugeClass(selectedMetric?.overallRisk || 0)}>
              <span>المخاطر الكلية</span>
              <strong>{fmtNum(selectedMetric?.overallRisk)}</strong>
            </div>
          </div>
        </section>

        {mode === 'command' && (
          <section className="panel table-wrap">
            <h2>تيار القياسات المباشر</h2>
            <table>
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>اللاعب</th>
                  <th>نبض</th>
                  <th>تسارع</th>
                  <th>حرارة</th>
                  <th>إجهاد</th>
                  <th>إصابة</th>
                  <th>جفاف</th>
                  <th>كلي</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>{fmtTime(metric.createdAt)}</td>
                    <td>{metric.playerName}</td>
                    <td>{metric.heartRate}</td>
                    <td>{metric.acceleration}</td>
                    <td>{metric.temperature}</td>
                    <td>{fmtNum(metric.fatigueScore)}</td>
                    <td>{fmtNum(metric.injuryRisk)}</td>
                    <td>{fmtNum(metric.hydrationRisk)}</td>
                    <td>{fmtNum(metric.overallRisk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {mode === 'executive' && (
          <section className="panel executive">
            <h2>الملخص التنفيذي</h2>
            <p>
              {selectedMetric
                ? `آخر تحديث للاعب ${selectedMetric.playerName} عند ${fmtTime(selectedMetric.createdAt)}.`
                : 'في انتظار أول قياس حي من الملعب.'}
            </p>
            <ul>
              <li>التنبيهات الحرجة الحالية: {alerts.filter((a) => a.severity === 'critical').length}</li>
              <li>تنبيهات عالية: {alerts.filter((a) => a.severity === 'high').length}</li>
              <li>جاهزية البث: {streamState}</li>
            </ul>
          </section>
        )}

        {mode === 'tactical' && (
          <section className="panel tactical">
            <h2>توصيات تكتيكية بالذكاء الاصطناعي</h2>
            <ul>
              {tacticalPlan.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel alerts">
          <h2>لوحة التنبيهات</h2>
          <ul>
            {alerts.map((alert) => (
              <li key={alert.id} className={alert.severity || 'moderate'}>
                <div>
                  <strong>{alert.playerName}</strong>
                  <span>{alert.message}</span>
                </div>
                <em>{fmtTime(alert.createdAt)}</em>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
