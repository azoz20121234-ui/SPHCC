const queryApiRoot = new URLSearchParams(window.location.search).get('api');
if (queryApiRoot) {
  localStorage.setItem('sphcc_api_root', queryApiRoot);
}
const API_ROOT = queryApiRoot || localStorage.getItem('sphcc_api_root') || 'http://localhost:4000';

const playerSelect = document.getElementById('playerSelect');
const refreshBtn = document.getElementById('refreshBtn');
const liveStatus = document.getElementById('liveStatus');

const fatigueGauge = document.getElementById('fatigueGauge');
const injuryGauge = document.getElementById('injuryGauge');
const hydrationGauge = document.getElementById('hydrationGauge');
const overallGauge = document.getElementById('overallGauge');

const fatigueValue = document.getElementById('fatigueValue');
const injuryValue = document.getElementById('injuryValue');
const hydrationValue = document.getElementById('hydrationValue');
const overallValue = document.getElementById('overallValue');

const tPlayer = document.getElementById('tPlayer');
const tHeart = document.getElementById('tHeart');
const tAcceleration = document.getElementById('tAcceleration');
const tTemperature = document.getElementById('tTemperature');
const tSleep = document.getElementById('tSleep');
const tUpdated = document.getElementById('tUpdated');

const alertsList = document.getElementById('alertsList');
const metricsBody = document.getElementById('metricsBody');

let selectedPlayerId = null;
let liveSource = null;

async function api(path, options) {
  const res = await fetch(`${API_ROOT}${path}`, options);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed');
  }
  return res.json();
}

function pickGaugeColor(score) {
  if (score >= 80) return '#ff3b30';
  if (score >= 60) return '#ff9f0a';
  if (score >= 35) return '#ffd60a';
  return '#0071e3';
}

function setGauge(el, value) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  const angle = (score / 100) * 360;
  const color = pickGaugeColor(score);
  el.style.background = `conic-gradient(${color} ${angle}deg, rgba(26, 34, 55, 0.95) ${angle}deg)`;
}

function updateGauges(metric) {
  fatigueValue.textContent = Number(metric.fatigueScore ?? 0).toFixed(1);
  injuryValue.textContent = Number(metric.injuryRisk ?? 0).toFixed(1);
  hydrationValue.textContent = Number(metric.hydrationRisk ?? 0).toFixed(1);
  overallValue.textContent = Number(metric.overallRisk ?? 0).toFixed(1);

  setGauge(fatigueGauge, metric.fatigueScore);
  setGauge(injuryGauge, metric.injuryRisk);
  setGauge(hydrationGauge, metric.hydrationRisk);
  setGauge(overallGauge, metric.overallRisk);
}

function updateTelemetry(metric) {
  tPlayer.textContent = metric.playerName || '-';
  tHeart.textContent = `${metric.heartRate ?? '-'} bpm`;
  tAcceleration.textContent = `${metric.acceleration ?? '-'} g`;
  tTemperature.textContent = `${metric.temperature ?? '-'} C`;
  tSleep.textContent = `${metric.sleepHours ?? '-'} h`;
  tUpdated.textContent = metric.createdAt ? new Date(metric.createdAt).toLocaleTimeString() : '-';
}

function prependMetric(metric) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${new Date(metric.createdAt).toLocaleTimeString()}</td>
    <td>${metric.playerName}</td>
    <td>${metric.heartRate}</td>
    <td>${metric.acceleration}</td>
    <td>${metric.temperature}</td>
    <td>${metric.fatigueScore}</td>
    <td>${metric.injuryRisk}</td>
    <td>${metric.hydrationRisk}</td>
    <td>${metric.overallRisk}</td>
  `;

  metricsBody.prepend(tr);
  while (metricsBody.children.length > 40) {
    metricsBody.removeChild(metricsBody.lastChild);
  }
}

function prependAlert(alert) {
  const li = document.createElement('li');
  li.className = alert.severity || 'moderate';
  li.innerHTML = `
    <strong>${alert.playerName} - ${alert.severity?.toUpperCase() || 'RISK'} (${alert.riskScore})</strong>
    <div>${alert.message}</div>
    <small>${new Date(alert.createdAt).toLocaleString()}</small>
  `;

  alertsList.prepend(li);
  while (alertsList.children.length > 40) {
    alertsList.removeChild(alertsList.lastChild);
  }
}

function metricMatchesSelection(metric) {
  return !selectedPlayerId || Number(metric.playerId) === Number(selectedPlayerId);
}

async function loadPlayers() {
  const players = await api('/api/players');
  playerSelect.innerHTML = '<option value="">All Players</option>';

  players.forEach((player) => {
    const option = document.createElement('option');
    option.value = String(player.id);
    option.textContent = `${player.name} (${player.sport})`;
    playerSelect.appendChild(option);
  });
}

async function loadInitialMetrics() {
  const path = selectedPlayerId
    ? `/api/metrics/latest?playerId=${selectedPlayerId}&limit=25`
    : '/api/metrics/latest?limit=25';

  const metrics = await api(path);
  metricsBody.innerHTML = '';
  if (!metrics.length) {
    updateGauges({ fatigueScore: 0, injuryRisk: 0, hydrationRisk: 0, overallRisk: 0 });
    updateTelemetry({});
    return;
  }

  [...metrics].reverse().forEach(prependMetric);
  const latest = metrics[0];
  updateGauges(latest);
  updateTelemetry(latest);
}

async function loadAlerts() {
  const alerts = await api('/api/alerts?status=active&limit=20');
  alertsList.innerHTML = '';
  [...alerts].reverse().forEach(prependAlert);
}

function connectLive() {
  if (liveSource) {
    liveSource.close();
  }

  liveStatus.textContent = 'Stream: connecting';
  liveSource = new EventSource(`${API_ROOT}/live`);

  liveSource.addEventListener('connected', () => {
    liveStatus.textContent = 'Stream: connected';
  });

  liveSource.addEventListener('metric', (event) => {
    const metric = JSON.parse(event.data);
    if (!metricMatchesSelection(metric)) {
      return;
    }

    prependMetric(metric);
    updateGauges(metric);
    updateTelemetry(metric);
  });

  liveSource.addEventListener('alert', (event) => {
    const alert = JSON.parse(event.data);
    if (selectedPlayerId && Number(alert.playerId) !== Number(selectedPlayerId)) {
      return;
    }
    prependAlert(alert);
  });

  liveSource.onerror = () => {
    liveStatus.textContent = 'Stream: reconnecting';
  };
}

playerSelect.addEventListener('change', async () => {
  selectedPlayerId = playerSelect.value ? Number(playerSelect.value) : null;
  await Promise.all([loadInitialMetrics(), loadAlerts()]);
});

refreshBtn.addEventListener('click', async () => {
  await Promise.all([loadInitialMetrics(), loadAlerts()]);
});

async function init() {
  try {
    await loadPlayers();
    await Promise.all([loadInitialMetrics(), loadAlerts()]);
    connectLive();
  } catch (error) {
    console.error(error);
    liveStatus.textContent = `Stream: failed (${error.message})`;
  }
}

init();
