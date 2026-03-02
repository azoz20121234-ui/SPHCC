import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  completeSimulationSession,
  createAlert,
  createIntervention,
  createMetric,
  createPlayer,
  createSimulationSession,
  executeIntervention,
  findRecentPendingIntervention,
  getLatestMetricForPlayer,
  getMetricById,
  getPlayerById,
  getPlayerTwinProfile,
  initDatabase,
  listAlerts,
  listInterventions,
  listLatestMetricPerPlayer,
  listMetricTrendForPlayer,
  listPlayers,
  listRecentMetrics,
  listSimulationSessions,
  resolveAlert,
  seedPlayersIfEmpty
} from './db/database.js';
import { calculatePredictiveRisk } from './riskEngine.js';
import { SCENARIO_PROFILES, createDigitalTwinSimulation } from './simulation/digitalTwin.js';
import {
  buildCompetitiveOverview,
  buildInterventionDrafts,
  buildTacticalAdvice,
  calculateReadiness
} from './services/innovation.js';
import { runDecisionEngine } from './services/aiDecisionEngine.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const LIVE_INTERVAL_MS = 2000;
const ALERT_THRESHOLD = Number(process.env.ALERT_THRESHOLD || 65);

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const frontendDistDir = path.join(frontendDir, 'dist');
const frontendStaticDir = fs.existsSync(frontendDistDir) ? frontendDistDir : null;

const liveClients = new Set();
const fatigueState = new Map();
let liveTicker = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function toSeverity(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  liveClients.forEach((client) => client.write(msg));
}

function mapMetricToPayload(metricRow) {
  const player = getPlayerById(metricRow.player_id);
  return {
    id: metricRow.id,
    playerId: metricRow.player_id,
    playerName: player?.name || 'Unknown player',
    sessionId: metricRow.session_id,
    heartRate: metricRow.heart_rate,
    acceleration: metricRow.acceleration,
    temperature: metricRow.temperature,
    sleepHours: metricRow.sleep_hours,
    fatigueScore: metricRow.fatigue_score,
    injuryRisk: metricRow.injury_risk,
    hydrationRisk: metricRow.hydration_risk,
    overallRisk: metricRow.overall_risk,
    source: metricRow.source,
    createdAt: metricRow.created_at
  };
}

function mapAlertToPayload(alertRow) {
  const player = getPlayerById(alertRow.player_id);
  return {
    id: alertRow.id,
    playerId: alertRow.player_id,
    playerName: player?.name || 'Unknown player',
    metricId: alertRow.metric_id,
    severity: alertRow.severity,
    riskScore: alertRow.risk_score,
    message: alertRow.message,
    status: alertRow.status,
    createdAt: alertRow.created_at,
    resolvedAt: alertRow.resolved_at
  };
}

function mapInterventionToPayload(interventionRow) {
  const player = getPlayerById(interventionRow.player_id);
  const metric = interventionRow.metric_id ? getMetricById(interventionRow.metric_id) : null;
  return {
    id: interventionRow.id,
    playerId: interventionRow.player_id,
    playerName: player?.name || 'Unknown player',
    metricId: interventionRow.metric_id,
    protocolKey: interventionRow.protocol_key,
    title: interventionRow.title,
    rationale: interventionRow.rationale,
    priority: interventionRow.priority,
    status: interventionRow.status,
    createdAt: interventionRow.created_at,
    executedAt: interventionRow.executed_at,
    linkedRisk: metric?.overall_risk ?? null
  };
}

function mapSimulationSession(row) {
  const player = getPlayerById(row.player_id);
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: player?.name || 'Unknown player',
    scenario: row.scenario,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    ticks: row.ticks,
    avgOverallRisk: row.avg_overall_risk,
    finalFatigue: row.final_fatigue,
    notes: row.notes
  };
}

function mapTwinToPayload(row) {
  if (!row) return null;
  return {
    playerId: row.player_id,
    recoverySpeed: Number(row.recovery_speed),
    injurySensitivity: Number(row.injury_sensitivity),
    neuralFatigueFactor: Number(row.neural_fatigue_factor),
    heatFactor: Number(row.heat_factor),
    updatedAt: row.updated_at
  };
}

function buildLiveInput(player) {
  const current = fatigueState.get(player.id) ?? random(24, 42);
  const nextFatigue = clamp(current + random(-2.5, 4.5), 16, 96);
  fatigueState.set(player.id, nextFatigue);

  const heartRate = clamp(player.resting_hr + nextFatigue * 1.15 + random(-6, 6), 50, player.max_hr + 5);
  const acceleration = clamp(0.9 + nextFatigue * 0.028 + random(-0.18, 0.22), 0.5, 5.5);
  const temperature = clamp(36.5 + nextFatigue * 0.02 + random(-0.15, 0.15), 35.8, 40.2);
  const sleepHours = clamp(7.2 + random(-2.4, 0.6), 3.5, 9.5);

  return {
    heartRate: Number(heartRate.toFixed(1)),
    acceleration: Number(acceleration.toFixed(2)),
    temperature: Number(temperature.toFixed(1)),
    sleepHours: Number(sleepHours.toFixed(1))
  };
}

function maybeCreateInterventions(metricPayload) {
  const drafts = buildInterventionDrafts(metricPayload);
  const created = [];

  drafts.forEach((draft) => {
    const exists = findRecentPendingIntervention({
      playerId: metricPayload.playerId,
      protocolKey: draft.protocolKey,
      windowMinutes: 35
    });

    if (exists) {
      return;
    }

    const row = createIntervention({
      playerId: metricPayload.playerId,
      metricId: metricPayload.id,
      protocolKey: draft.protocolKey,
      title: draft.title,
      rationale: draft.rationale,
      priority: draft.priority
    });

    const payload = mapInterventionToPayload(row);
    created.push(payload);
    broadcast('intervention', payload);
  });

  return created;
}

function ingestMetric({ playerId, sessionId = null, source = 'live-feed', input }) {
  const player = getPlayerById(playerId);
  if (!player) {
    return null;
  }

  const prediction = calculatePredictiveRisk(input);
  const metricRow = createMetric({
    playerId: player.id,
    sessionId,
    source,
    heartRate: input.heartRate,
    acceleration: input.acceleration,
    temperature: input.temperature,
    sleepHours: input.sleepHours,
    fatigueScore: prediction.fatigueScore,
    injuryRisk: prediction.injuryRisk,
    hydrationRisk: prediction.hydrationRisk,
    overallRisk: prediction.overallRisk,
    createdAt: new Date().toISOString()
  });

  const metricPayload = mapMetricToPayload(metricRow);
  broadcast('metric', metricPayload);

  let alertPayload = null;
  if (prediction.overallRisk >= ALERT_THRESHOLD) {
    const alertRow = createAlert({
      playerId: player.id,
      metricId: metricRow.id,
      severity: prediction.severity || toSeverity(prediction.overallRisk),
      riskScore: prediction.overallRisk,
      message: `${player.name} high risk detected (${prediction.overallRisk})`
    });
    alertPayload = mapAlertToPayload(alertRow);
    broadcast('alert', alertPayload);
  }

  const interventions = maybeCreateInterventions(metricPayload);

  return {
    ...metricPayload,
    alert: alertPayload,
    interventions
  };
}

const simulation = createDigitalTwinSimulation({
  getPlayerById,
  getPlayerTwinProfile,
  onMetric: ({ playerId, sessionId, source, input }) =>
    ingestMetric({ playerId, sessionId, source, input }),
  onStart: ({ id, playerId, scenario, notes }) =>
    createSimulationSession({ id, playerId, scenario, notes }),
  onComplete: ({ id, status, ticks, avgOverallRisk, finalFatigue }) =>
    completeSimulationSession({ id, status, ticks, avgOverallRisk, finalFatigue })
});

function buildDashboard() {
  const metrics = listRecentMetrics({ limit: 80 });
  const activeAlerts = listAlerts({ status: 'active', limit: 200 });
  const pendingInterventions = listInterventions({ status: 'pending', limit: 300 });
  const avgRisk =
    metrics.length === 0
      ? 0
      : metrics.reduce((sum, item) => sum + Number(item.overall_risk), 0) / metrics.length;

  const latestByPlayer = listLatestMetricPerPlayer();
  const readinessValues = latestByPlayer.map((item) =>
    calculateReadiness({
      overallRisk: item.overall_risk,
      fatigueScore: item.fatigue_score,
      hydrationRisk: item.hydration_risk,
      injuryRisk: item.injury_risk
    })
  );

  const teamReadiness =
    readinessValues.length === 0
      ? 0
      : Number((readinessValues.reduce((sum, val) => sum + val, 0) / readinessValues.length).toFixed(1));

  return {
    playersCount: listPlayers().length,
    activeAlerts: activeAlerts.length,
    avgRisk: Number(avgRisk.toFixed(1)),
    interventionBacklog: pendingInterventions.length,
    teamReadiness,
    latestMetricAt: metrics[0]?.created_at || null
  };
}

function startLiveTicker() {
  if (liveTicker) {
    return;
  }

  liveTicker = setInterval(() => {
    const players = listPlayers();
    players.forEach((player) => {
      const input = buildLiveInput(player);
      ingestMetric({ playerId: player.id, input, source: 'live-feed' });
    });

    broadcast('dashboard', buildDashboard());
  }, LIVE_INTERVAL_MS);
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SPHCC API',
    sseClients: liveClients.size,
    liveTickerRunning: Boolean(liveTicker),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/dashboard', (_req, res) => {
  res.json(buildDashboard());
});

app.get('/api/analytics/overview', (_req, res) => {
  const players = listPlayers();
  const latestRows = listLatestMetricPerPlayer();
  const latestMap = new Map(latestRows.map((row) => [row.player_id, mapMetricToPayload(row)]));

  const dataRows = players.map((player) => ({
    player,
    metric: latestMap.get(player.id) || null
  }));

  const pending = listInterventions({ status: 'pending', limit: 300 });
  const overview = buildCompetitiveOverview(dataRows, pending.map(mapInterventionToPayload));
  res.json(overview);
});

app.get('/api/players', (_req, res) => {
  res.json(listPlayers());
});

app.post('/api/players', (req, res) => {
  const { name, sport, position, age, restingHr, maxHr } = req.body;
  if (!name || !sport) {
    return res.status(400).json({ error: 'name and sport are required' });
  }

  const player = createPlayer({ name, sport, position, age, restingHr, maxHr });
  return res.status(201).json(player);
});

app.get('/api/players/:id/profile', (req, res) => {
  const playerId = Number(req.params.id);
  const player = getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ error: 'player not found' });
  }

  const trend = listMetricTrendForPlayer(playerId, 20).map(mapMetricToPayload);
  const latest = trend[0] || null;

  const profile = {
    player,
    digitalTwin: mapTwinToPayload(getPlayerTwinProfile(playerId)),
    readiness: calculateReadiness(latest),
    latestMetric: latest,
    tacticalAdvice: buildTacticalAdvice(latest),
    decisionNow: latest ? runDecisionEngine(latest) : null,
    trend: trend.reverse()
  };

  res.json(profile);
});

app.get('/api/players/:id/twin', (req, res) => {
  const playerId = Number(req.params.id);
  const player = getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ error: 'player not found' });
  }

  const twin = getPlayerTwinProfile(playerId);
  return res.json({
    playerId,
    playerName: player.name,
    twin: mapTwinToPayload(twin)
  });
});

app.get('/api/decision/now', (req, res) => {
  const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
  const metricRow = playerId
    ? getLatestMetricForPlayer(playerId)
    : listRecentMetrics({ limit: 1 })[0];

  if (!metricRow) {
    return res.status(404).json({ error: 'no live metric available yet' });
  }

  const metric = mapMetricToPayload(metricRow);
  const decision = runDecisionEngine(metric);

  res.json({
    playerId: metric.playerId,
    playerName: metric.playerName,
    metric,
    decision
  });
});

app.get('/api/metrics/latest', (req, res) => {
  const limit = Number(req.query.limit || 30);
  const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
  const rows = listRecentMetrics({ playerId, limit });
  res.json(rows.map(mapMetricToPayload));
});

app.post('/api/metrics', (req, res) => {
  const { playerId, heartRate, acceleration, temperature, sleepHours, sessionId, source } = req.body;
  const required = [playerId, heartRate, acceleration, temperature, sleepHours];
  if (required.some((item) => item === undefined || item === null || item === '')) {
    return res.status(400).json({
      error: 'playerId, heartRate, acceleration, temperature, and sleepHours are required'
    });
  }

  const metric = ingestMetric({
    playerId: Number(playerId),
    sessionId: sessionId || null,
    source: source || 'manual-input',
    input: {
      heartRate: Number(heartRate),
      acceleration: Number(acceleration),
      temperature: Number(temperature),
      sleepHours: Number(sleepHours)
    }
  });

  if (!metric) {
    return res.status(404).json({ error: 'player not found' });
  }

  return res.status(201).json(metric);
});

app.get('/api/alerts', (req, res) => {
  const status = String(req.query.status || 'active');
  const limit = Number(req.query.limit || 40);
  res.json(listAlerts({ status, limit }).map(mapAlertToPayload));
});

app.patch('/api/alerts/:id/resolve', (req, res) => {
  const alert = resolveAlert(Number(req.params.id));
  if (!alert) {
    return res.status(404).json({ error: 'alert not found' });
  }

  const payload = mapAlertToPayload(alert);
  broadcast('alert-resolved', payload);
  return res.json(payload);
});

app.get('/api/interventions', (req, res) => {
  const status = String(req.query.status || 'pending');
  const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
  const limit = Number(req.query.limit || 50);
  const rows = listInterventions({ status, playerId, limit });
  res.json(rows.map(mapInterventionToPayload));
});

app.post('/api/interventions/auto', (req, res) => {
  const playerId = req.body?.playerId ? Number(req.body.playerId) : undefined;
  const targetPlayers = playerId ? [getPlayerById(playerId)].filter(Boolean) : listPlayers();

  const created = [];
  targetPlayers.forEach((player) => {
    const latest = getLatestMetricForPlayer(player.id);
    if (!latest) {
      return;
    }

    const payload = mapMetricToPayload(latest);
    const interventions = maybeCreateInterventions(payload);
    created.push(...interventions);
  });

  res.status(201).json({ createdCount: created.length, interventions: created });
});

app.patch('/api/interventions/:id/execute', (req, res) => {
  const executed = executeIntervention(Number(req.params.id));
  if (!executed) {
    return res.status(404).json({ error: 'intervention not found' });
  }

  const payload = mapInterventionToPayload(executed);
  broadcast('intervention-executed', payload);
  return res.json(payload);
});

app.get('/api/simulation/scenarios', (_req, res) => {
  res.json(Object.values(SCENARIO_PROFILES));
});

app.get('/api/simulation/sessions', (req, res) => {
  const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
  const limit = Number(req.query.limit || 20);
  const sessions = listSimulationSessions({ playerId, limit }).map(mapSimulationSession);
  res.json(sessions);
});

app.get('/api/simulation/compare', (req, res) => {
  const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
  const sessions = listSimulationSessions({ playerId, limit: 10 }).map(mapSimulationSession);

  const byScenario = Object.values(SCENARIO_PROFILES).map((scenario) => {
    const matched = sessions.filter((item) => item.scenario === scenario.key);
    const avgRisk =
      matched.length === 0
        ? 0
        : matched.reduce((sum, item) => sum + Number(item.avgOverallRisk || 0), 0) / matched.length;

    return {
      scenario: scenario.key,
      label: scenario.label,
      runs: matched.length,
      avgOverallRisk: Number(avgRisk.toFixed(1))
    };
  });

  res.json({ sessions, byScenario });
});

app.get('/api/simulation/active', (_req, res) => {
  res.json(simulation.listActive());
});

app.post('/api/simulation/start', (req, res) => {
  const { playerId, durationTicks, sleepHours, scenario, notes } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  const started = simulation.start({
    playerId,
    durationTicks,
    sleepHours,
    scenario,
    notes
  });

  if (started?.error) {
    return res.status(404).json({ error: started.error });
  }

  broadcast('simulation-started', started);
  return res.status(201).json(started);
});

app.post('/api/simulation/stop/:sessionId', (req, res) => {
  const finished = simulation.stop(req.params.sessionId, 'stopped');
  if (!finished) {
    return res.status(404).json({ error: 'session not found or already finished' });
  }

  const payload = mapSimulationSession(finished);
  broadcast('simulation-ended', payload);
  return res.json(payload);
});

app.get('/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const hello = {
    connectedAt: new Date().toISOString(),
    intervalMs: LIVE_INTERVAL_MS,
    threshold: ALERT_THRESHOLD,
    features: ['analytics', 'interventions', 'simulation-scenarios']
  };

  res.write(`event: connected\ndata: ${JSON.stringify(hello)}\n\n`);
  liveClients.add(res);

  req.on('close', () => {
    liveClients.delete(res);
  });
});

if (frontendStaticDir) {
  app.use(express.static(frontendStaticDir));

  app.get(/^\/(?!api|live).*/, (_req, res) => {
    res.sendFile(path.join(frontendStaticDir, 'index.html'));
  });
}

app.listen(port, () => {
  initDatabase();
  seedPlayersIfEmpty();
  startLiveTicker();
  console.log(`SPHCC API listening on http://localhost:${port}`);
});
