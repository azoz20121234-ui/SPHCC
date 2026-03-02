import express from 'express';
import cors from 'cors';
import {
  createAlert,
  createMetric,
  createPlayer,
  getPlayerById,
  initDatabase,
  listAlerts,
  listPlayers,
  listRecentMetrics,
  resolveAlert,
  seedPlayersIfEmpty
} from './db/database.js';
import { calculatePredictiveRisk } from './riskEngine.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const LIVE_INTERVAL_MS = 2000;
const ALERT_THRESHOLD = Number(process.env.ALERT_THRESHOLD || 65);

app.use(cors());
app.use(express.json());

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

  if (prediction.overallRisk >= ALERT_THRESHOLD) {
    const alert = createAlert({
      playerId: player.id,
      metricId: metricRow.id,
      severity: prediction.severity || toSeverity(prediction.overallRisk),
      riskScore: prediction.overallRisk,
      message: `${player.name} high risk detected (${prediction.overallRisk})`
    });

    broadcast('alert', {
      id: alert.id,
      playerId: alert.player_id,
      playerName: player.name,
      metricId: alert.metric_id,
      severity: alert.severity,
      riskScore: alert.risk_score,
      message: alert.message,
      status: alert.status,
      createdAt: alert.created_at
    });
  }

  return metricPayload;
}

function buildDashboard() {
  const metrics = listRecentMetrics({ limit: 80 });
  const activeAlerts = listAlerts({ status: 'active', limit: 200 });
  const avgRisk =
    metrics.length === 0
      ? 0
      : metrics.reduce((sum, item) => sum + Number(item.overall_risk), 0) / metrics.length;

  return {
    playersCount: listPlayers().length,
    activeAlerts: activeAlerts.length,
    avgRisk: Number(avgRisk.toFixed(1)),
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
  const alerts = listAlerts({ status, limit }).map((item) => {
    const player = getPlayerById(item.player_id);
    return {
      id: item.id,
      playerId: item.player_id,
      playerName: player?.name || 'Unknown player',
      metricId: item.metric_id,
      severity: item.severity,
      riskScore: item.risk_score,
      message: item.message,
      status: item.status,
      createdAt: item.created_at,
      resolvedAt: item.resolved_at
    };
  });

  res.json(alerts);
});

app.patch('/api/alerts/:id/resolve', (req, res) => {
  const alert = resolveAlert(Number(req.params.id));
  if (!alert) {
    return res.status(404).json({ error: 'alert not found' });
  }

  const player = getPlayerById(alert.player_id);
  const payload = {
    id: alert.id,
    playerId: alert.player_id,
    playerName: player?.name || 'Unknown player',
    metricId: alert.metric_id,
    severity: alert.severity,
    riskScore: alert.risk_score,
    message: alert.message,
    status: alert.status,
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at
  };

  broadcast('alert-resolved', payload);
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
    threshold: ALERT_THRESHOLD
  };

  res.write(`event: connected\ndata: ${JSON.stringify(hello)}\n\n`);
  liveClients.add(res);

  req.on('close', () => {
    liveClients.delete(res);
  });
});

app.listen(port, () => {
  initDatabase();
  seedPlayersIfEmpty();
  startLiveTicker();
  console.log(`SPHCC API listening on http://localhost:${port}`);
});
