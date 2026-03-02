import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'sphcc.sqlite');

let db;

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDb() {
  return db || initDatabase();
}

function hasColumn(tableName, columnName) {
  const columns = getDb().prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((col) => col.name === columnName);
}

function ensureColumn(tableName, columnName, alterStatement) {
  if (!hasColumn(tableName, columnName)) {
    getDb().exec(alterStatement);
  }
}

export function initDatabase() {
  if (db) {
    return db;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sport TEXT NOT NULL,
      position TEXT,
      age INTEGER,
      resting_hr INTEGER DEFAULT 58,
      max_hr INTEGER DEFAULT 195,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      session_id TEXT,
      heart_rate REAL NOT NULL,
      acceleration REAL NOT NULL,
      temperature REAL NOT NULL,
      sleep_hours REAL NOT NULL,
      fatigue_score REAL NOT NULL,
      injury_risk REAL NOT NULL,
      hydration_risk REAL NOT NULL,
      overall_risk REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      metric_id INTEGER,
      severity TEXT NOT NULL,
      risk_score REAL NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS simulation_sessions (
      id TEXT PRIMARY KEY,
      player_id INTEGER NOT NULL,
      scenario TEXT NOT NULL DEFAULT 'balanced',
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      ticks INTEGER NOT NULL DEFAULT 0,
      avg_overall_risk REAL DEFAULT 0,
      final_fatigue REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      metric_id INTEGER,
      protocol_key TEXT NOT NULL,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      executed_at TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS player_digital_twin (
      player_id INTEGER PRIMARY KEY,
      recovery_speed REAL NOT NULL DEFAULT 1.0,
      injury_sensitivity REAL NOT NULL DEFAULT 1.0,
      neural_fatigue_factor REAL NOT NULL DEFAULT 1.0,
      heat_factor REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_player_created ON metrics(player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON alerts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_simulation_player_started ON simulation_sessions(player_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_interventions_status_created ON interventions(status, created_at DESC);
  `);

  ensureColumn(
    'simulation_sessions',
    'scenario',
    "ALTER TABLE simulation_sessions ADD COLUMN scenario TEXT NOT NULL DEFAULT 'balanced'"
  );

  return db;
}

export function listPlayers() {
  return getDb().prepare('SELECT * FROM players ORDER BY id ASC').all();
}

export function getPlayerById(playerId) {
  return getDb().prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
}

export function createPlayer({ name, sport, position, age, restingHr = 58, maxHr = 195 }) {
  const stmt = getDb().prepare(`
    INSERT INTO players (name, sport, position, age, resting_hr, max_hr, created_at)
    VALUES (@name, @sport, @position, @age, @resting_hr, @max_hr, @created_at)
  `);

  const result = stmt.run({
    name,
    sport,
    position: position || null,
    age: age ? Number(age) : null,
    resting_hr: Number(restingHr),
    max_hr: Number(maxHr),
    created_at: nowIso()
  });

  const player = getPlayerById(result.lastInsertRowid);
  upsertPlayerTwinProfile({
    playerId: player.id,
    ...buildDefaultTwinProfile(player)
  });
  return player;
}

export function seedPlayersIfEmpty() {
  const count = getDb().prepare('SELECT COUNT(*) AS count FROM players').get().count;
  if (count === 0) {
    createPlayer({
      name: 'Khaled Nasser',
      sport: 'Football',
      position: 'Midfielder',
      age: 24,
      restingHr: 56,
      maxHr: 193
    });

    createPlayer({
      name: 'Fahad Salem',
      sport: 'Basketball',
      position: 'Guard',
      age: 21,
      restingHr: 60,
      maxHr: 197
    });
  }

  ensureTwinProfilesForAllPlayers();
}

function buildDefaultTwinProfile(player) {
  const sport = String(player?.sport || '').toLowerCase();
  const age = Number(player?.age || 24);

  const base = {
    recoverySpeed: 1.0,
    injurySensitivity: 1.0,
    neuralFatigueFactor: 1.0,
    heatFactor: 1.0
  };

  if (sport.includes('football')) {
    base.recoverySpeed = 0.97;
    base.injurySensitivity = 1.06;
    base.neuralFatigueFactor = 1.07;
    base.heatFactor = 1.05;
  } else if (sport.includes('basketball')) {
    base.recoverySpeed = 1.03;
    base.injurySensitivity = 0.97;
    base.neuralFatigueFactor = 1.11;
    base.heatFactor = 0.96;
  }

  const ageDelta = clamp((age - 24) * 0.01, -0.08, 0.1);

  return {
    recoverySpeed: Number(clamp(base.recoverySpeed - ageDelta, 0.82, 1.2).toFixed(2)),
    injurySensitivity: Number(clamp(base.injurySensitivity + ageDelta * 1.1, 0.82, 1.28).toFixed(2)),
    neuralFatigueFactor: Number(clamp(base.neuralFatigueFactor + ageDelta * 0.9, 0.82, 1.28).toFixed(2)),
    heatFactor: Number(clamp(base.heatFactor + ageDelta * 0.8, 0.82, 1.28).toFixed(2))
  };
}

export function upsertPlayerTwinProfile({
  playerId,
  recoverySpeed = 1.0,
  injurySensitivity = 1.0,
  neuralFatigueFactor = 1.0,
  heatFactor = 1.0
}) {
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO player_digital_twin
      (player_id, recovery_speed, injury_sensitivity, neural_fatigue_factor, heat_factor, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        recovery_speed = excluded.recovery_speed,
        injury_sensitivity = excluded.injury_sensitivity,
        neural_fatigue_factor = excluded.neural_fatigue_factor,
        heat_factor = excluded.heat_factor,
        updated_at = excluded.updated_at`
    )
    .run(
      Number(playerId),
      Number(clamp(recoverySpeed, 0.7, 1.4).toFixed(2)),
      Number(clamp(injurySensitivity, 0.7, 1.4).toFixed(2)),
      Number(clamp(neuralFatigueFactor, 0.7, 1.4).toFixed(2)),
      Number(clamp(heatFactor, 0.7, 1.4).toFixed(2)),
      now,
      now
    );

  return getPlayerTwinProfile(playerId);
}

export function getPlayerTwinProfile(playerId) {
  const id = Number(playerId);
  const existing = getDb().prepare('SELECT * FROM player_digital_twin WHERE player_id = ?').get(id);
  if (existing) {
    return existing;
  }

  const player = getPlayerById(id);
  if (!player) {
    return null;
  }

  return upsertPlayerTwinProfile({
    playerId: id,
    ...buildDefaultTwinProfile(player)
  });
}

export function listPlayerTwinProfiles() {
  return getDb()
    .prepare(
      `SELECT t.*, p.name AS player_name
       FROM player_digital_twin t
       INNER JOIN players p ON p.id = t.player_id
       ORDER BY t.player_id ASC`
    )
    .all();
}

function ensureTwinProfilesForAllPlayers() {
  listPlayers().forEach((player) => {
    getPlayerTwinProfile(player.id);
  });
}

export function createMetric(payload) {
  const stmt = getDb().prepare(`
    INSERT INTO metrics (
      player_id, session_id, heart_rate, acceleration, temperature, sleep_hours,
      fatigue_score, injury_risk, hydration_risk, overall_risk, source, created_at
    ) VALUES (
      @player_id, @session_id, @heart_rate, @acceleration, @temperature, @sleep_hours,
      @fatigue_score, @injury_risk, @hydration_risk, @overall_risk, @source, @created_at
    )
  `);

  const result = stmt.run({
    player_id: Number(payload.playerId),
    session_id: payload.sessionId || null,
    heart_rate: Number(payload.heartRate),
    acceleration: Number(payload.acceleration),
    temperature: Number(payload.temperature),
    sleep_hours: Number(payload.sleepHours),
    fatigue_score: Number(payload.fatigueScore),
    injury_risk: Number(payload.injuryRisk),
    hydration_risk: Number(payload.hydrationRisk),
    overall_risk: Number(payload.overallRisk),
    source: payload.source || 'live',
    created_at: payload.createdAt || nowIso()
  });

  return getDb().prepare('SELECT * FROM metrics WHERE id = ?').get(result.lastInsertRowid);
}

export function getMetricById(metricId) {
  return getDb().prepare('SELECT * FROM metrics WHERE id = ?').get(Number(metricId));
}

export function listRecentMetrics({ playerId, limit = 30 } = {}) {
  if (playerId) {
    return getDb()
      .prepare('SELECT * FROM metrics WHERE player_id = ? ORDER BY id DESC LIMIT ?')
      .all(Number(playerId), Number(limit));
  }

  return getDb().prepare('SELECT * FROM metrics ORDER BY id DESC LIMIT ?').all(Number(limit));
}

export function getLatestMetricForPlayer(playerId) {
  return getDb()
    .prepare('SELECT * FROM metrics WHERE player_id = ? ORDER BY id DESC LIMIT 1')
    .get(Number(playerId));
}

export function listLatestMetricPerPlayer() {
  return getDb()
    .prepare(
      `SELECT m.*
       FROM metrics m
       INNER JOIN (
         SELECT player_id, MAX(id) AS max_id
         FROM metrics
         GROUP BY player_id
       ) latest ON latest.max_id = m.id
       ORDER BY m.player_id ASC`
    )
    .all();
}

export function listMetricTrendForPlayer(playerId, limit = 20) {
  return getDb()
    .prepare('SELECT * FROM metrics WHERE player_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(playerId), Number(limit));
}

export function createAlert({ playerId, metricId, severity, riskScore, message }) {
  const stmt = getDb().prepare(`
    INSERT INTO alerts (player_id, metric_id, severity, risk_score, message, status, created_at)
    VALUES (@player_id, @metric_id, @severity, @risk_score, @message, 'active', @created_at)
  `);

  const result = stmt.run({
    player_id: Number(playerId),
    metric_id: metricId ? Number(metricId) : null,
    severity,
    risk_score: Number(riskScore),
    message,
    created_at: nowIso()
  });

  return getDb().prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
}

export function listAlerts({ status = 'active', limit = 40 } = {}) {
  if (status === 'all') {
    return getDb().prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?').all(Number(limit));
  }

  return getDb()
    .prepare('SELECT * FROM alerts WHERE status = ? ORDER BY id DESC LIMIT ?')
    .all(status, Number(limit));
}

export function resolveAlert(alertId) {
  getDb()
    .prepare('UPDATE alerts SET status = ?, resolved_at = ? WHERE id = ?')
    .run('resolved', nowIso(), Number(alertId));

  return getDb().prepare('SELECT * FROM alerts WHERE id = ?').get(Number(alertId));
}

export function createIntervention({
  playerId,
  metricId,
  protocolKey,
  title,
  rationale,
  priority = 50
}) {
  const result = getDb()
    .prepare(
      `INSERT INTO interventions
      (player_id, metric_id, protocol_key, title, rationale, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      Number(playerId),
      metricId ? Number(metricId) : null,
      protocolKey,
      title,
      rationale,
      Number(priority),
      nowIso()
    );

  return getDb().prepare('SELECT * FROM interventions WHERE id = ?').get(result.lastInsertRowid);
}

export function findRecentPendingIntervention({ playerId, protocolKey, windowMinutes = 30 }) {
  const threshold = new Date(Date.now() - Number(windowMinutes) * 60 * 1000).toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM interventions
       WHERE player_id = ?
         AND protocol_key = ?
         AND status = 'pending'
         AND created_at >= ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(Number(playerId), protocolKey, threshold);
}

export function listInterventions({ status = 'pending', playerId, limit = 50 } = {}) {
  if (playerId && status !== 'all') {
    return getDb()
      .prepare(
        `SELECT * FROM interventions
         WHERE player_id = ? AND status = ?
         ORDER BY priority DESC, id DESC LIMIT ?`
      )
      .all(Number(playerId), status, Number(limit));
  }

  if (playerId) {
    return getDb()
      .prepare(
        `SELECT * FROM interventions
         WHERE player_id = ?
         ORDER BY priority DESC, id DESC LIMIT ?`
      )
      .all(Number(playerId), Number(limit));
  }

  if (status === 'all') {
    return getDb()
      .prepare('SELECT * FROM interventions ORDER BY priority DESC, id DESC LIMIT ?')
      .all(Number(limit));
  }

  return getDb()
    .prepare(
      `SELECT * FROM interventions
       WHERE status = ?
       ORDER BY priority DESC, id DESC LIMIT ?`
    )
    .all(status, Number(limit));
}

export function executeIntervention(interventionId) {
  getDb()
    .prepare(
      `UPDATE interventions
       SET status = 'executed', executed_at = ?
       WHERE id = ?`
    )
    .run(nowIso(), Number(interventionId));

  return getDb().prepare('SELECT * FROM interventions WHERE id = ?').get(Number(interventionId));
}

export function createSimulationSession({ id, playerId, scenario = 'balanced', notes }) {
  getDb()
    .prepare(
      `INSERT INTO simulation_sessions (id, player_id, scenario, status, started_at, notes)
       VALUES (?, ?, ?, 'running', ?, ?)`
    )
    .run(id, Number(playerId), scenario, nowIso(), notes || null);

  return getDb().prepare('SELECT * FROM simulation_sessions WHERE id = ?').get(id);
}

export function completeSimulationSession({
  id,
  ticks,
  avgOverallRisk,
  finalFatigue,
  status = 'completed'
}) {
  getDb()
    .prepare(
      `UPDATE simulation_sessions
       SET status = ?,
           ended_at = ?,
           ticks = ?,
           avg_overall_risk = ?,
           final_fatigue = ?
       WHERE id = ?`
    )
    .run(status, nowIso(), Number(ticks), Number(avgOverallRisk), Number(finalFatigue), id);

  return getDb().prepare('SELECT * FROM simulation_sessions WHERE id = ?').get(id);
}

export function stopSimulationSession(id) {
  getDb()
    .prepare(
      `UPDATE simulation_sessions
       SET status = 'stopped',
           ended_at = ?
       WHERE id = ? AND status = 'running'`
    )
    .run(nowIso(), id);

  return getDb().prepare('SELECT * FROM simulation_sessions WHERE id = ?').get(id);
}

export function listSimulationSessions({ playerId, limit = 30 } = {}) {
  if (playerId) {
    return getDb()
      .prepare(
        'SELECT * FROM simulation_sessions WHERE player_id = ? ORDER BY started_at DESC LIMIT ?'
      )
      .all(Number(playerId), Number(limit));
  }

  return getDb()
    .prepare('SELECT * FROM simulation_sessions ORDER BY started_at DESC LIMIT ?')
    .all(Number(limit));
}
