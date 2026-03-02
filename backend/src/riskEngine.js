function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHeartRate(heartRate) {
  return clamp(((Number(heartRate) - 60) / (200 - 60)) * 100);
}

function normalizeAcceleration(acceleration) {
  // Expected acceleration range in g-force for high-intensity sports movement.
  return clamp(((Number(acceleration) - 0.8) / (5.0 - 0.8)) * 100);
}

function normalizeTemperature(temperature) {
  return clamp(((Number(temperature) - 36.5) / (40.0 - 36.5)) * 100);
}

function normalizeSleepDebt(sleepHours) {
  // 8 hours is target; lower sleep increases risk.
  return clamp(((8 - Number(sleepHours)) / 4) * 100);
}

function severityFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

/**
 * Predictive risk engine for sports-health monitoring.
 *
 * Input:
 * - heartRate: bpm
 * - acceleration: g
 * - temperature: celsius
 * - sleepHours: hours in previous sleep cycle
 */
export function calculatePredictiveRisk({ heartRate, acceleration, temperature, sleepHours }) {
  const hr = normalizeHeartRate(heartRate);
  const acc = normalizeAcceleration(acceleration);
  const temp = normalizeTemperature(temperature);
  const sleepDebt = normalizeSleepDebt(sleepHours);

  const fatigueScore = clamp(hr * 0.4 + temp * 0.25 + acc * 0.2 + sleepDebt * 0.15);
  const injuryRisk = clamp(acc * 0.4 + fatigueScore * 0.25 + temp * 0.2 + sleepDebt * 0.15);
  const hydrationRisk = clamp(temp * 0.45 + hr * 0.3 + acc * 0.15 + sleepDebt * 0.1);

  const overallRisk = clamp(fatigueScore * 0.35 + injuryRisk * 0.4 + hydrationRisk * 0.25);

  return {
    fatigueScore: Number(fatigueScore.toFixed(1)),
    injuryRisk: Number(injuryRisk.toFixed(1)),
    hydrationRisk: Number(hydrationRisk.toFixed(1)),
    overallRisk: Number(overallRisk.toFixed(1)),
    severity: severityFromScore(overallRisk),
    factors: {
      heartRateNormalized: Number(hr.toFixed(1)),
      accelerationNormalized: Number(acc.toFixed(1)),
      temperatureNormalized: Number(temp.toFixed(1)),
      sleepDebtNormalized: Number(sleepDebt.toFixed(1))
    }
  };
}
