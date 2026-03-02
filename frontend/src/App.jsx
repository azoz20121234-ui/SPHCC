import { useEffect, useMemo, useRef, useState } from 'react';
import ExecutiveView from './components/ExecutiveView.jsx';
import TacticalDecisionCenter from './components/TacticalDecisionCenter.jsx';
import HeatMapComponent from './components/HeatMapComponent.jsx';
import CountdownToBreakdown from './components/CountdownToBreakdown.jsx';
import TimelineProjection from './components/TimelineProjection.jsx';
import MultiPlayerComparison from './components/MultiPlayerComparison.jsx';
import SmartServicesPanel from './components/SmartServicesPanel.jsx';
import { startTelemetry } from './engine/telemetryEngine.js';
import { calculateRiskSnapshot } from './engine/riskEngine.js';
import { buildFinancialExposureFromRisk, buildMatchImpactFromRisk } from './engine/impactEngine.js';
import { generateAiDecision } from './engine/aiEngine.js';

const MODES = {
  executive: 'تنفيذي',
  command: 'مركز قيادة حي',
  tactical: 'تكتيكي بالذكاء الاصطناعي',
  season: 'توقع الموسم'
};

const LOCAL_PLAYERS = [
  { id: 1, name: 'خالد ناصر', sport: 'Football', position: 'Midfielder' },
  { id: 2, name: 'فهد سالم', sport: 'Basketball', position: 'Guard' },
  { id: 3, name: 'سامي العتيبي', sport: 'Football', position: 'Winger' }
];

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

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function buildSeasonForecast(metric) {
  const matches = Array.from({ length: 20 }).map((_, idx) => {
    const match = idx + 1;
    const fatigue = clamp(metric.fatigueScore + idx * 1.6 + Math.sin(match * 0.9) * 3, 0, 100);
    const heatStress = clamp(metric.hydrationRisk * 0.5 + idx * 0.7, 0, 100);
    const injuryProbability = clamp(metric.injuryRisk + idx * 1.1 + heatStress * 0.12, 0, 100);
    return {
      match,
      fatigue: Number(fatigue.toFixed(1)),
      heatStress: Number(heatStress.toFixed(1)),
      injuryProbability: Number(injuryProbability.toFixed(1)),
      recommendation: injuryProbability > 72 ? 'راحة/تدوير' : 'جاهز للمشاركة'
    };
  });

  const peak = matches.reduce((acc, item) => (item.fatigue > acc.fatigue ? item : acc), matches[0]);
  return {
    forecast: {
      totalMatches: 20,
      avgInjuryProbability: Number(
        (matches.reduce((sum, m) => sum + m.injuryProbability, 0) / matches.length).toFixed(1)
      ),
      peakStrain: {
        match: peak.match,
        strain: Number((peak.fatigue * 0.6 + peak.injuryProbability * 0.4).toFixed(1))
      },
      bestRestWindows: matches
        .filter((m) => m.injuryProbability >= 70)
        .slice(0, 5)
        .map((m) => ({
          match: m.match,
          reason: 'احتمالية إصابة مرتفعة'
        })),
      matches
    }
  };
}

function buildOverview(players, metrics) {
  const latestByPlayer = new Map();
  metrics.forEach((metric) => {
    if (!latestByPlayer.has(metric.playerId)) {
      latestByPlayer.set(metric.playerId, metric);
    }
  });

  const rows = players.map((player) => {
    const metric = latestByPlayer.get(player.id);
    const readiness = metric ? Number(clamp(100 - metric.overallRisk * 0.84, 0, 100).toFixed(1)) : 0;
    return {
      playerId: player.id,
      playerName: player.name,
      sport: player.sport,
      position: player.position,
      readiness,
      overallRisk: metric?.overallRisk || 0,
      injuryRisk: metric?.injuryRisk || 0,
      hydrationRisk: metric?.hydrationRisk || 0,
      fatigueScore: metric?.fatigueScore || 0,
      updatedAt: metric?.createdAt || null
    };
  });

  return {
    teamReadiness:
      rows.length === 0
        ? 0
        : Number((rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length).toFixed(1)),
    interventionBacklog: 0,
    hotRiskList: [...rows].sort((a, b) => b.overallRisk - a.overallRisk).slice(0, 5),
    readinessBoard: [...rows].sort((a, b) => b.readiness - a.readiness),
    hydrationWatch: [...rows].sort((a, b) => b.hydrationRisk - a.hydrationRisk).slice(0, 5)
  };
}

function buildPlayerProfile(player, metric) {
  if (!player || !metric) return null;
  const tacticalAdvice = [];
  if (metric.overallRisk >= 78) tacticalAdvice.push('تبديل وقائي فوري مع تبريد سريع.');
  else if (metric.overallRisk >= 60) tacticalAdvice.push('خفض الشدة ومراجعة المؤشرات بعد 3 دقائق.');
  else tacticalAdvice.push('الاستمرار الحالي آمن مع مراقبة لحظية.');
  if (metric.hydrationRisk >= 55) tacticalAdvice.push('تدخل ترطيب فوري.');
  if (metric.injuryRisk >= 68) tacticalAdvice.push('تجنب الالتحامات عالية الشدة.');

  return {
    player,
    readiness: Number(clamp(100 - metric.overallRisk * 0.82, 0, 100).toFixed(1)),
    latestMetric: metric,
    tacticalAdvice
  };
}

export default function App() {
  const [mode, setMode] = useState('executive');
  const [players] = useState(LOCAL_PLAYERS);
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
  const [matchImpact, setMatchImpact] = useState(null);
  const [financialExposure, setFinancialExposure] = useState(null);
  const [seasonForecast, setSeasonForecast] = useState(null);
  const [simulationCompare, setSimulationCompare] = useState({ sessions: [], byScenario: [] });
  const [activeSimulations, setActiveSimulations] = useState([]);
  const [scenarios] = useState([
    { key: 'balanced', label: 'مباراة متوازنة' },
    { key: 'intense', label: 'ضغط تنافسي عالٍ' },
    { key: 'heatwave', label: 'أجواء حارة ورطبة' }
  ]);

  const [streamState, setStreamState] = useState('تشغيل محلي');
  const [actionMessage, setActionMessage] = useState('جاهز للمحاكاة');
  const [simForm, setSimForm] = useState({
    scenario: 'balanced',
    durationTicks: 24,
    sleepHours: 6.6,
    notes: ''
  });
  const fatigueHistoryRef = useRef([]);

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
  const latestMetricsMap = useMemo(() => {
    const map = new Map();
    metrics.forEach((metric) => {
      if (!map.has(metric.playerId)) {
        map.set(metric.playerId, metric);
      }
    });
    return map;
  }, [metrics]);

  const selectedPlayer = useMemo(() => {
    if (selectedPlayerId === 'all') {
      return players[0];
    }
    return players.find((player) => String(player.id) === String(selectedPlayerId)) || players[0];
  }, [players, selectedPlayerId]);

  function refreshAll() {
    setActionMessage('تم تحديث المحاكاة المحلية');
  }

  function handleAutoInterventions() {
    if (!selectedMetric) return;
    const intervention = {
      id: `local-int-${selectedMetric.id}`,
      playerId: selectedMetric.playerId,
      playerName: selectedMetric.playerName,
      title: selectedMetric.overallRisk >= 70 ? 'تبديل وقائي فوري' : 'خفض الشدة لمدة 3 دقائق',
      rationale:
        selectedMetric.overallRisk >= 70
          ? 'المخاطر تجاوزت عتبة القرار الوقائي.'
          : 'توازن المخاطر يتطلب تقليل الحمل مؤقتًا.',
      priority: Math.round(clamp(selectedMetric.overallRisk, 45, 95)),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    setInterventions((prev) => [intervention, ...prev].slice(0, 60));
    setActionMessage('تم توليد تدخل محلي من محرك الذكاء');
  }

  function handleExecuteIntervention(id) {
    setInterventions((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'executed',
              executedAt: new Date().toISOString()
            }
          : item
      )
    );
    setActionMessage('تم تنفيذ التدخل محليًا');
  }

  function handleStartSimulation(event) {
    event.preventDefault();
    if (selectedPlayerId === 'all') {
      setActionMessage('اختر لاعبًا أولاً قبل تشغيل الجلسة');
      return;
    }

    const session = {
      id: `sim-${Date.now()}`,
      playerId: Number(selectedPlayerId),
      scenario: simForm.scenario,
      ticks: 0,
      maxTicks: Number(simForm.durationTicks),
      sleepHours: Number(simForm.sleepHours)
    };

    setActiveSimulations((prev) => [session, ...prev].slice(0, 10));
    setSimulationCompare((prev) => {
      const existing = prev.byScenario.find((row) => row.scenario === simForm.scenario);
      if (existing) {
        return {
          ...prev,
          byScenario: prev.byScenario.map((row) =>
            row.scenario === simForm.scenario ? { ...row, runs: row.runs + 1 } : row
          )
        };
      }
      return {
        ...prev,
        byScenario: [
          ...prev.byScenario,
          { scenario: simForm.scenario, runs: 1, avgOverallRisk: Number(selectedMetric?.overallRisk || 0) }
        ]
      };
    });
    setActionMessage('تم تشغيل جلسة محاكاة محلية');
  }

  function handleStopSimulation(sessionId) {
    setActiveSimulations((prev) => prev.filter((session) => session.id !== sessionId));
    setActionMessage('تم إيقاف الجلسة المحلية');
  }

  useEffect(() => {
    let metricId = 1;
    fatigueHistoryRef.current = [];
    setStreamState('محرك البيانات المحلي متصل');

    const stopTelemetry = startTelemetry(
      (sample) => {
        const nextFatigueHistory = [...fatigueHistoryRef.current, Number(sample.fatigue)].slice(-6);
        fatigueHistoryRef.current = nextFatigueHistory;

        const riskSnapshot = calculateRiskSnapshot(sample, nextFatigueHistory, 75);
        const overallRisk = Number(riskSnapshot.risk);
        const hydrationRisk = Number(clamp(100 - Number(sample.hydration || 0), 0, 100).toFixed(1));
        const injuryRisk = Number(clamp(overallRisk * 0.78 + Number(sample.neuralLoad || 0) * 0.22, 0, 100).toFixed(1));

        const metric = {
          id: `${selectedPlayer.id}-${metricId}`,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          heartRate: Number(sample.heartRate.toFixed(1)),
          acceleration: Number((0.8 + sample.fatigue * 0.027 + sample.neuralLoad * 0.009).toFixed(2)),
          temperature: Number((36.3 + sample.heatStress * 0.03).toFixed(1)),
          sleepHours: Number(clamp(8.2 - sample.neuralLoad * 0.02, 4.2, 8.5).toFixed(1)),
          fatigueScore: Number(sample.fatigue.toFixed(1)),
          injuryRisk,
          hydrationRisk,
          overallRisk,
          escalationRate: Number(riskSnapshot.escalationRate),
          countdownToThreshold: Number(riskSnapshot.countdownToThreshold),
          createdAt: new Date().toISOString(),
          source: 'client-simulation'
        };
        metricId += 1;

        setMetrics((prev) => {
          const nextMetrics = [metric, ...prev].slice(0, 140);
          const latestByPlayer = new Map();
          nextMetrics.forEach((item) => {
            if (!latestByPlayer.has(item.playerId)) latestByPlayer.set(item.playerId, item);
          });

          const latestRows = [...latestByPlayer.values()];
          const avgRisk =
            latestRows.length === 0
              ? 0
              : latestRows.reduce((sum, item) => sum + Number(item.overallRisk), 0) / latestRows.length;
          const readinessValues = latestRows.map((item) => clamp(100 - Number(item.overallRisk) * 0.84, 0, 100));
          const activeAlertsCount = nextMetrics.filter((item) => Number(item.overallRisk) >= 75).length;

          setDashboard({
            playersCount: players.length,
            activeAlerts: activeAlertsCount,
            avgRisk: Number(avgRisk.toFixed(1)),
            interventionBacklog: 0,
            teamReadiness:
              readinessValues.length === 0
                ? 0
                : Number(
                    (readinessValues.reduce((sum, item) => sum + item, 0) / readinessValues.length).toFixed(1)
                  ),
            latestMetricAt: metric.createdAt
          });
          setOverview(buildOverview(players, nextMetrics));
          return nextMetrics;
        });

        if (metric.overallRisk >= 75) {
          const alertPayload = {
            id: `alert-${metric.id}`,
            playerId: metric.playerId,
            playerName: metric.playerName,
            severity: metric.overallRisk >= 85 ? 'critical' : 'high',
            message: `تحذير محلي: ${metric.playerName} دخل منطقة خطر مرتفعة (${metric.overallRisk}%)`,
            createdAt: metric.createdAt
          };
          setAlerts((prev) => [alertPayload, ...prev].slice(0, 80));
        }

        const impact = buildMatchImpactFromRisk(metric.overallRisk);
        const decision = generateAiDecision(metric, impact);
        const exposure = buildFinancialExposureFromRisk(metric.overallRisk);
        const season = buildSeasonForecast(metric);

        setDecisionCenter({
          playerId: metric.playerId,
          playerName: metric.playerName,
          metric,
          decision
        });
        setMatchImpact(impact);
        setFinancialExposure(exposure);
        setSeasonForecast(season);

        if (selectedPlayerId === 'all') {
          setPlayerProfile(null);
        } else {
          setPlayerProfile(buildPlayerProfile(selectedPlayer, metric));
        }
      },
      { playerId: selectedPlayer.id }
    );

    return () => {
      stopTelemetry();
    };
  }, [players.length, selectedPlayer.id, selectedPlayerId]);

  return (
    <div className={`app mode-${mode}`} dir="rtl">
      <header className="shell topbar">
        <div className="topbar-main">
          <div>
            <h1>SPHCC منصة القيادة التنبؤية الرياضية</h1>
            <p>منصة ابتكار صحية تنافسية - تشغيل لحظي، تدخلات ذكية، ومحاكاة رقمية</p>
          </div>

          <div className="segmented mode-switch" id="mode">
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
        </div>
        <div className="top-meta">
          <span className="pill">{streamState}</span>
          <span className="mini-pill">{actionMessage}</span>
        </div>
      </header>

      <main className="shell main-grid">
        <section className="panel controls layout-col-1">
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

        <section className="panel stats layout-col-2">
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

        <section className="panel gauges layout-full">
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
            financialExposure={financialExposure}
            fmtNum={fmtNum}
            fmtTime={fmtTime}
          />
        )}

        {mode === 'command' && (
          <>
            <section className="panel table-wrap layout-col-2">
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

            <section className="panel layout-col-1">
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

            <MultiPlayerComparison players={players} latestMetricsMap={latestMetricsMap} fmtNum={fmtNum} />
            <SmartServicesPanel selectedMetric={selectedMetric} />
          </>
        )}

        {mode === 'tactical' && (
          <>
            <TacticalDecisionCenter decisionData={decisionCenter} fmtNum={fmtNum} />
            <CountdownToBreakdown
              selectedMetric={selectedMetric}
              decisionData={decisionCenter}
              matchImpact={matchImpact}
            />
            <TimelineProjection selectedMetric={selectedMetric} />
            <HeatMapComponent selectedMetric={selectedMetric} decisionData={decisionCenter} />

            <section className="panel match-impact layout-col-2">
              <h2>تحليل تأثير المباراة</h2>
              {matchImpact ? (
                <>
                  <div className="decision-impact-grid">
                    <article>
                      <span>{matchImpact.impact.continueFiveMinutes.label}</span>
                      <strong>{fmtNum(matchImpact.impact.continueFiveMinutes.projectedRisk)}%</strong>
                      <small>
                        تأثير الفوز: {fmtNum(matchImpact.impact.continueFiveMinutes.winProbability)}%
                      </small>
                    </article>
                    <article>
                      <span>{matchImpact.impact.substituteNow.label}</span>
                      <strong>{fmtNum(matchImpact.impact.substituteNow.projectedRisk)}%</strong>
                      <small>
                        تأثير الفوز: {fmtNum(matchImpact.impact.substituteNow.winProbability)}%
                      </small>
                    </article>
                  </div>
                  <p className="muted">
                    Delta احتمالية الفوز: <b>{fmtNum(matchImpact.impact.deltaWinProbability)}%</b>
                  </p>
                  <ul className="list clean curve-list">
                    {matchImpact.impact.riskEscalationCurve.map((point) => (
                      <li key={point.minute}>
                        <div>
                          <strong>دقيقة {point.minute}</strong>
                          <small>
                            استمرار: {fmtNum(point.continueRisk)}% | تبديل: {fmtNum(point.substituteRisk)}%
                          </small>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill continue"
                            style={{ width: `${Math.min(100, Number(point.continueRisk))}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">اختر لاعبًا لعرض تحليل تأثير المباراة.</p>
              )}
            </section>

            <section className="panel split tactical layout-col-1">
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

            <section className="panel split layout-col-2">
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

            <section className="panel layout-full">
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

        {mode === 'season' && (
          <>
            <section className="panel split season-summary layout-col-2">
              <article>
                <h2>ملخص توقع الموسم</h2>
                {seasonForecast ? (
                  <ul className="list clean">
                    <li>
                      <span>عدد المباريات المحاكاة</span>
                      <strong>{seasonForecast.forecast.totalMatches}</strong>
                    </li>
                    <li>
                      <span>متوسط احتمالية الإصابة</span>
                      <strong>{fmtNum(seasonForecast.forecast.avgInjuryProbability)}%</strong>
                    </li>
                    <li>
                      <span>ذروة الإجهاد</span>
                      <strong>
                        مباراة {seasonForecast.forecast.peakStrain?.match} (
                        {fmtNum(seasonForecast.forecast.peakStrain?.strain)})
                      </strong>
                    </li>
                  </ul>
                ) : (
                  <p className="muted">اختر لاعبًا لبدء توقع الموسم.</p>
                )}
              </article>
              <article>
                <h2>أفضل نوافذ الراحة</h2>
                <ul className="list clean">
                  {(seasonForecast?.forecast?.bestRestWindows || []).map((window) => (
                    <li key={`rest-${window.match}`}>
                      <span>المباراة {window.match}</span>
                      <strong>{window.reason}</strong>
                    </li>
                  ))}
                  {(!seasonForecast?.forecast?.bestRestWindows ||
                    seasonForecast.forecast.bestRestWindows.length === 0) && (
                    <li>
                      <span>لا توجد نافذة حرجة حالياً</span>
                    </li>
                  )}
                </ul>
              </article>
            </section>

            <section className="panel table-wrap layout-full">
              <h2>توقع 20 مباراة</h2>
              <table>
                <thead>
                  <tr>
                    <th>المباراة</th>
                    <th>الإجهاد</th>
                    <th>إجهاد حراري</th>
                    <th>احتمالية الإصابة</th>
                    <th>توصية</th>
                  </tr>
                </thead>
                <tbody>
                  {(seasonForecast?.forecast?.matches || []).map((row) => (
                    <tr key={`season-${row.match}`}>
                      <td>{row.match}</td>
                      <td>{fmtNum(row.fatigue)}%</td>
                      <td>{fmtNum(row.heatStress)}%</td>
                      <td>{fmtNum(row.injuryProbability)}%</td>
                      <td>{row.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        <section className="panel alerts layout-full">
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
