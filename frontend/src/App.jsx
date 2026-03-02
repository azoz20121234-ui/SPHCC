import { useEffect, useMemo, useState } from 'react';
import ExecutiveView from './components/ExecutiveView.jsx';
import TacticalDecisionCenter from './components/TacticalDecisionCenter.jsx';

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
  return new Date(value).toLocaleString('ar-SA');
}

function gaugeClass(score) {
  if (score >= 80) return 'gauge critical';
  if (score >= 60) return 'gauge high';
  if (score >= 35) return 'gauge moderate';
  return 'gauge low';
}

function compareLabel(list, key) {
  return list.find((item) => item.scenario === key || item.key === key)?.label || key;
}

export default function App() {
  const [mode, setMode] = useState('executive');
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('all');

  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [dashboard, setDashboard] = useState({
    playersCount: 0,
    activeAlerts: 0,
    avgRisk: 0,
    interventionBacklog: 0,
    teamReadiness: 0
  });

  const [overview, setOverview] = useState({
    teamReadiness: 0,
    interventionBacklog: 0,
    hotRiskList: [],
    readinessBoard: [],
    hydrationWatch: []
  });

  const [playerProfile, setPlayerProfile] = useState(null);
  const [decisionCenter, setDecisionCenter] = useState(null);
  const [simulationCompare, setSimulationCompare] = useState({ sessions: [], byScenario: [] });
  const [activeSimulations, setActiveSimulations] = useState([]);
  const [scenarios, setScenarios] = useState([]);

  const [streamState, setStreamState] = useState('جاري الاتصال...');
  const [actionMessage, setActionMessage] = useState('جاهز للتشغيل');
  const [simForm, setSimForm] = useState({
    scenario: 'balanced',
    durationTicks: 24,
    sleepHours: 6.6,
    notes: ''
  });

  const filteredMetrics = useMemo(() => {
    if (selectedPlayerId === 'all') return metrics;
    return metrics.filter((item) => String(item.playerId) === String(selectedPlayerId));
  }, [metrics, selectedPlayerId]);

  const filteredAlerts = useMemo(() => {
    if (selectedPlayerId === 'all') return alerts;
    return alerts.filter((item) => String(item.playerId) === String(selectedPlayerId));
  }, [alerts, selectedPlayerId]);

  const filteredInterventions = useMemo(() => {
    if (selectedPlayerId === 'all') return interventions;
    return interventions.filter((item) => String(item.playerId) === String(selectedPlayerId));
  }, [interventions, selectedPlayerId]);

  const selectedMetric = filteredMetrics[0] || null;

  async function request(path, options) {
    const res = await fetch(`${API_ROOT}${path}`, options);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Request failed');
    }
    return res.json();
  }

  async function loadGlobalSnapshot() {
    const [playersData, metricsData, alertsData, dashboardData, interventionsData, overviewData, scenarioData] =
      await Promise.all([
        request('/api/players'),
        request('/api/metrics/latest?limit=60'),
        request('/api/alerts?status=active&limit=60'),
        request('/api/dashboard'),
        request('/api/interventions?status=pending&limit=60'),
        request('/api/analytics/overview'),
        request('/api/simulation/scenarios')
      ]);

    setPlayers(playersData);
    setMetrics(metricsData);
    setAlerts(alertsData);
    setDashboard(dashboardData);
    setInterventions(interventionsData);
    setOverview(overviewData);
    setScenarios(scenarioData);
  }

  async function loadPlayerDepth(playerId) {
    if (playerId === 'all') {
      setPlayerProfile(null);
      setDecisionCenter(null);
      setSimulationCompare({ sessions: [], byScenario: [] });
      return;
    }

    const [profileData, compareData, decisionData] = await Promise.all([
      request(`/api/players/${playerId}/profile`),
      request(`/api/simulation/compare?playerId=${playerId}`),
      request(`/api/decision/now?playerId=${playerId}`)
    ]);

    setPlayerProfile(profileData);
    setSimulationCompare(compareData);
    setDecisionCenter(decisionData);
  }

  async function loadActiveSimulations() {
    const active = await request('/api/simulation/active');
    setActiveSimulations(active);
  }

  async function refreshAll() {
    await loadGlobalSnapshot();
    await loadPlayerDepth(selectedPlayerId);
    await loadActiveSimulations();
  }

  useEffect(() => {
    refreshAll().catch((err) => setActionMessage(`فشل التحميل: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId]);

  useEffect(() => {
    const source = new EventSource(`${API_ROOT}/live`);

    source.addEventListener('connected', () => setStreamState('البث الحي متصل'));

    source.addEventListener('metric', (event) => {
      const metric = JSON.parse(event.data);
      setMetrics((prev) => [metric, ...prev].slice(0, 120));
    });

    source.addEventListener('alert', (event) => {
      const alert = JSON.parse(event.data);
      setAlerts((prev) => [alert, ...prev].slice(0, 120));
    });

    source.addEventListener('intervention', (event) => {
      const intervention = JSON.parse(event.data);
      setInterventions((prev) => [intervention, ...prev].slice(0, 120));
      setActionMessage(`تم إنشاء تدخل آلي: ${intervention.title}`);
    });

    source.addEventListener('intervention-executed', (event) => {
      const payload = JSON.parse(event.data);
      setInterventions((prev) => prev.map((item) => (item.id === payload.id ? payload : item)));
    });

    source.addEventListener('simulation-started', () => {
      loadActiveSimulations().catch(() => {});
    });

    source.addEventListener('simulation-ended', () => {
      loadActiveSimulations().catch(() => {});
      loadPlayerDepth(selectedPlayerId).catch(() => {});
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

  async function handleAutoInterventions() {
    try {
      const payload =
        selectedPlayerId === 'all'
          ? {}
          : {
              playerId: Number(selectedPlayerId)
            };

      const result = await request('/api/interventions/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setActionMessage(`تم إنشاء ${result.createdCount} تدخل علاجي تلقائي`);
      await refreshAll();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  async function handleExecuteIntervention(id) {
    try {
      await request(`/api/interventions/${id}/execute`, { method: 'PATCH' });
      setActionMessage('تم تنفيذ التدخل بنجاح');
      await refreshAll();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  async function handleStartSimulation(event) {
    event.preventDefault();
    if (selectedPlayerId === 'all') {
      setActionMessage('اختر لاعبًا أولاً قبل تشغيل المحاكاة');
      return;
    }

    try {
      await request('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: Number(selectedPlayerId),
          scenario: simForm.scenario,
          durationTicks: Number(simForm.durationTicks),
          sleepHours: Number(simForm.sleepHours),
          notes: simForm.notes
        })
      });

      setActionMessage('تم تشغيل جلسة المحاكاة الرقمية');
      await refreshAll();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  async function handleStopSimulation(sessionId) {
    try {
      await request(`/api/simulation/stop/${sessionId}`, { method: 'POST' });
      setActionMessage('تم إيقاف جلسة المحاكاة');
      await refreshAll();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  return (
    <div className={`app mode-${mode}`}>
      <header className="shell topbar">
        <div>
          <h1>SPHCC منصة القيادة التنبؤية الرياضية</h1>
          <p>منصة ابتكار صحية تنافسية - تشغيل لحظي، تدخلات ذكية، ومحاكاة رقمية</p>
        </div>
        <div className="top-meta">
          <span className="pill">{streamState}</span>
          <span className="mini-pill">{actionMessage}</span>
        </div>
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

          <div className="control-actions">
            <button type="button" onClick={refreshAll}>
              تحديث شامل
            </button>
            <button type="button" onClick={handleAutoInterventions}>
              توليد تدخلات تلقائيًا
            </button>
          </div>
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
            <span>تدخلات بانتظار التنفيذ</span>
            <strong>{dashboard.interventionBacklog}</strong>
          </article>
          <article>
            <span>جاهزية الفريق</span>
            <strong>{fmtNum(dashboard.teamReadiness)}</strong>
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

        {mode === 'executive' && (
          <ExecutiveView
            overview={overview}
            dashboard={dashboard}
            selectedMetric={selectedMetric}
            playerProfile={playerProfile}
            fmtNum={fmtNum}
            fmtTime={fmtTime}
          />
        )}

        {mode === 'command' && (
          <>
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
                  {filteredMetrics.slice(0, 40).map((metric) => (
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

            <section className="panel">
              <h2>طابور التدخلات الطبية الذكية</h2>
              <ul className="list">
                {filteredInterventions.map((item) => (
                  <li key={item.id} className="intervention-item">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.playerName}</span>
                      <p>{item.rationale}</p>
                    </div>
                    <div className="intervention-meta">
                      <em>أولوية {item.priority}</em>
                      {item.status === 'pending' ? (
                        <button type="button" onClick={() => handleExecuteIntervention(item.id)}>
                          تنفيذ
                        </button>
                      ) : (
                        <span className="done">تم التنفيذ</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {mode === 'tactical' && (
          <>
            <TacticalDecisionCenter decisionData={decisionCenter} fmtNum={fmtNum} />

            <section className="panel split tactical">
              <article>
                <h2>مساعد القرار التكتيكي</h2>
                <ul className="list clean">
                  {(playerProfile?.tacticalAdvice || ['اختر لاعبًا لمشاهدة التوصيات']).map((line, idx) => (
                    <li key={`${line}-${idx}`}>{line}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h2>ملف اللاعب الذكي</h2>
                {playerProfile ? (
                  <ul className="list clean">
                    <li>
                      <span>اللاعب</span>
                      <strong>{playerProfile.player.name}</strong>
                    </li>
                    <li>
                      <span>جاهزية اللاعب</span>
                      <strong>{fmtNum(playerProfile.readiness)}</strong>
                    </li>
                    <li>
                      <span>آخر تحديث</span>
                      <strong>{fmtTime(playerProfile.latestMetric?.createdAt)}</strong>
                    </li>
                  </ul>
                ) : (
                  <p>اختر لاعبًا لعرض الملف الذكي.</p>
                )}
              </article>
            </section>

            <section className="panel split">
              <article>
                <h2>مختبر السيناريوهات الرقمية</h2>
                <form className="sim-form" onSubmit={handleStartSimulation}>
                  <label htmlFor="scenario">السيناريو</label>
                  <select
                    id="scenario"
                    value={simForm.scenario}
                    onChange={(event) =>
                      setSimForm((prev) => ({
                        ...prev,
                        scenario: event.target.value
                      }))
                    }
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.key} value={scenario.key}>
                        {scenario.label}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="ticks">مدة المحاكاة (Ticks)</label>
                  <input
                    id="ticks"
                    type="number"
                    min="5"
                    max="120"
                    value={simForm.durationTicks}
                    onChange={(event) =>
                      setSimForm((prev) => ({
                        ...prev,
                        durationTicks: event.target.value
                      }))
                    }
                  />

                  <label htmlFor="sleep">ساعات النوم المتوقعة</label>
                  <input
                    id="sleep"
                    type="number"
                    min="3"
                    max="9"
                    step="0.1"
                    value={simForm.sleepHours}
                    onChange={(event) =>
                      setSimForm((prev) => ({
                        ...prev,
                        sleepHours: event.target.value
                      }))
                    }
                  />

                  <label htmlFor="notes">ملاحظات</label>
                  <input
                    id="notes"
                    type="text"
                    value={simForm.notes}
                    onChange={(event) =>
                      setSimForm((prev) => ({
                        ...prev,
                        notes: event.target.value
                      }))
                    }
                  />

                  <button type="submit">تشغيل محاكاة</button>
                </form>
              </article>

              <article>
                <h2>المحاكاة النشطة</h2>
                <ul className="list clean">
                  {activeSimulations.length === 0 && <li>لا توجد جلسات نشطة</li>}
                  {activeSimulations.map((session) => (
                    <li key={session.id}>
                      <span>
                        {session.scenario} - {session.ticks}/{session.maxTicks}
                      </span>
                      <button type="button" onClick={() => handleStopSimulation(session.id)}>
                        إيقاف
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="panel">
              <h2>مقارنة أثر السيناريوهات</h2>
              <ul className="list clean three bars">
                {simulationCompare.byScenario.map((row) => (
                  <li key={row.scenario}>
                    <div>
                      <span>{compareLabel(scenarios, row.scenario)}</span>
                      <small>عدد التشغيلات: {row.runs}</small>
                    </div>
                    <strong>{fmtNum(row.avgOverallRisk)}</strong>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${Math.min(100, Number(row.avgOverallRisk))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <section className="panel alerts">
          <h2>لوحة التنبيهات</h2>
          <ul className="list">
            {filteredAlerts.slice(0, 40).map((alert) => (
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
