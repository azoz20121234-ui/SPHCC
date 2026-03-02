const THRESHOLD = 75;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

export function calculateRisk(data) {
  const fatigue = Number(data?.fatigue || 0);
  const neuralLoad = Number(data?.neuralLoad || 0);
  const heatStress = Number(data?.heatStress || 0);
  const hydration = Number(data?.hydration || 0);

  const risk = fatigue * 0.4 + neuralLoad * 0.3 + heatStress * 0.2 + (100 - hydration) * 0.1;
  return round(clamp(risk, 0, 100), 1);
}

export function calculateEscalationRate(fatigueHistory = []) {
  const series = fatigueHistory.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (series.length < 2) {
    return 0.1;
  }

  const deltas = [];
  for (let idx = 1; idx < series.length; idx += 1) {
    deltas.push(series[idx] - series[idx - 1]);
  }

  const avgFatigueDelta = deltas.reduce((sum, item) => sum + item, 0) / deltas.length;
  const riskRatePerSecond = avgFatigueDelta * 0.4;
  return round(Math.max(0.05, riskRatePerSecond), 3);
}

export function calculateCountdown(risk, escalationRate, threshold = THRESHOLD) {
  const riskValue = Number(risk || 0);
  const rateValue = Number(escalationRate || 0);

  if (riskValue >= threshold) {
    return 0;
  }

  if (rateValue <= 0) {
    return Infinity;
  }

  return Math.max(0, Math.floor((threshold - riskValue) / rateValue));
}

export function calculateRiskSnapshot(data, fatigueHistory = [], threshold = THRESHOLD) {
  const risk = calculateRisk(data);
  const escalationRate = calculateEscalationRate(fatigueHistory);
  const countdownToThreshold = calculateCountdown(risk, escalationRate, threshold);

  return {
    risk,
    escalationRate,
    countdownToThreshold,
    threshold
  };
}
