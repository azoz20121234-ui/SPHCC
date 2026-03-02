import express from 'express';
import cors from 'cors';
import { initDatabase, seedPlayersIfEmpty } from './db/database.js';
import {
  addAlert,
  addAppointment,
  addAthlete,
  addReading,
  findAthleteById,
  getAlerts,
  getAppointments,
  getAthletes,
  getDashboardSnapshot,
  getReadings,
  resolveAlert
} from './core/store.js';
import { buildAlertFromReading, evaluateRisk } from './core/risk-engine.js';
import { createLiveSimulator } from './core/simulator.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const streamClients = new Set();

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  streamClients.forEach((client) => client.write(msg));
}

function ingestReading(rawReading) {
  const athlete = findAthleteById(rawReading.athleteId);
  if (!athlete) {
    return { error: 'athlete not found', status: 404 };
  }

  const reading = addReading({
    athleteId: athlete.id,
    heartRate: Number(rawReading.heartRate),
    spo2: Number(rawReading.spo2),
    temperature: Number(rawReading.temperature),
    hydration: Number(rawReading.hydration),
    movementAsymmetry: Number(rawReading.movementAsymmetry),
    strain: Number(rawReading.strain),
    source: rawReading.source || 'manual'
  });

  const risk = evaluateRisk(reading);
  const alertDraft = buildAlertFromReading(athlete, reading, risk);
  const createdAlert = alertDraft ? addAlert(alertDraft) : null;

  const dashboard = getDashboardSnapshot();
  broadcast('reading', { ...reading, athleteName: athlete.name, risk });
  if (createdAlert) {
    broadcast('alert', createdAlert);
  }
  broadcast('dashboard', dashboard);

  return {
    data: {
      reading,
      risk,
      alert: createdAlert,
      dashboard
    }
  };
}

const simulator = createLiveSimulator({
  getAthletes,
  onReading: (reading) => {
    ingestReading(reading);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SPHCC API',
    simulatorRunning: simulator.isRunning(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboardSnapshot());
});

app.get('/api/athletes', (_req, res) => {
  res.json(getAthletes());
});

app.post('/api/athletes', (req, res) => {
  const { name, sport, position, age, baseline } = req.body;
  if (!name || !sport || !position || !age) {
    return res.status(400).json({ error: 'name, sport, position, and age are required' });
  }

  const athlete = addAthlete({ name, sport, position, age, baseline });
  broadcast('dashboard', getDashboardSnapshot());
  return res.status(201).json(athlete);
});

app.get('/api/appointments', (_req, res) => {
  const athletes = getAthletes();
  const data = getAppointments().map((item) => ({
    ...item,
    athleteName: athletes.find((a) => a.id === item.athleteId)?.name || 'Unknown athlete'
  }));

  res.json(data);
});

app.post('/api/appointments', (req, res) => {
  const { athleteId, date, notes } = req.body;
  const athlete = findAthleteById(athleteId);

  if (!athlete) {
    return res.status(404).json({ error: 'athlete not found' });
  }
  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  const appointment = addAppointment({ athleteId: athlete.id, date, notes });
  broadcast('dashboard', getDashboardSnapshot());
  return res.status(201).json(appointment);
});

app.get('/api/readings', (req, res) => {
  const limit = Number(req.query.limit || 50);
  const athletes = getAthletes();
  const data = getReadings(limit).map((item) => ({
    ...item,
    athleteName: athletes.find((a) => a.id === item.athleteId)?.name || 'Unknown athlete'
  }));

  res.json(data);
});

app.post('/api/readings', (req, res) => {
  const {
    athleteId,
    heartRate,
    spo2,
    temperature,
    hydration,
    movementAsymmetry,
    strain,
    source
  } = req.body;

  const required = [athleteId, heartRate, spo2, temperature, hydration, movementAsymmetry, strain];
  if (required.some((item) => item === undefined || item === null || item === '')) {
    return res.status(400).json({
      error: 'athleteId, heartRate, spo2, temperature, hydration, movementAsymmetry, and strain are required'
    });
  }

  const result = ingestReading({
    athleteId,
    heartRate,
    spo2,
    temperature,
    hydration,
    movementAsymmetry,
    strain,
    source
  });

  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  return res.status(201).json(result.data);
});

app.get('/api/alerts', (req, res) => {
  const active = req.query.active === 'true' ? true : undefined;
  const severity = req.query.severity ? String(req.query.severity) : undefined;
  const limit = Number(req.query.limit || 100);
  res.json(getAlerts({ active, severity, limit }));
});

app.patch('/api/alerts/:id/resolve', (req, res) => {
  const alert = resolveAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'alert not found' });
  }
  broadcast('dashboard', getDashboardSnapshot());
  return res.json(alert);
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
  streamClients.add(res);

  req.on('close', () => {
    streamClients.delete(res);
  });
});

app.post('/api/simulator/start', (_req, res) => {
  const started = simulator.start();
  broadcast('simulator', { running: simulator.isRunning() });
  res.json({ running: simulator.isRunning(), changed: started });
});

app.post('/api/simulator/stop', (_req, res) => {
  const stopped = simulator.stop();
  broadcast('simulator', { running: simulator.isRunning() });
  res.json({ running: simulator.isRunning(), changed: stopped });
});

app.listen(port, () => {
  initDatabase();
  seedPlayersIfEmpty();
  simulator.start();
  console.log(`SPHCC API listening on http://localhost:${port}`);
});
