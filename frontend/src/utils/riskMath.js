export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAcceleration(acceleration) {
  return clamp(((Number(acceleration || 0) - 0.7) / (5.5 - 0.7)) * 100);
}

export function computeNeuralLoad(selectedMetric, decisionData) {
  if (decisionData?.decision?.inputs?.neuralLoad !== undefined) {
    return Number(decisionData.decision.inputs.neuralLoad);
  }

  const fatigueScore = Number(selectedMetric?.fatigueScore || 0);
  const accelerationFactor = normalizeAcceleration(selectedMetric?.acceleration) * 0.38;
  const fatigueFactor = fatigueScore * 0.44;
  const sleepDebt = clamp((8 - Number(selectedMetric?.sleepHours || 0)) * 14);
  return Number(clamp(fatigueFactor + accelerationFactor + sleepDebt).toFixed(1));
}

export function estimateRiskEscalationPerMinute(selectedMetric, neuralLoad, matchImpact) {
  const curve = matchImpact?.impact?.riskEscalationCurve || [];
  if (curve.length >= 2) {
    const start = Number(curve[0].continueRisk || 0);
    const end = Number(curve[curve.length - 1].continueRisk || start);
    const minutes = Math.max(1, Number(curve[curve.length - 1].minute || 1));
    const delta = (end - start) / minutes;
    return clamp(delta, 0.4, 8.5);
  }

  const fatigue = Number(selectedMetric?.fatigueScore || 0);
  const temperature = Number(selectedMetric?.temperature || 37);
  const thermalLoad = clamp((temperature - 37.2) * 2.4, 0, 8);
  return clamp(0.8 + fatigue * 0.032 + neuralLoad * 0.016 + thermalLoad, 0.5, 8.5);
}

export function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const minPart = String(minutes);
  const secPart = String(seconds).padStart(2, '0');
  return `${minPart}:${secPart}`;
}
