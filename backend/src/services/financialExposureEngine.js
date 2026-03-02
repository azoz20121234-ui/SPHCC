function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roundNumber(value, digits = 0) {
  return Number(Number(value).toFixed(digits));
}

function toClassification(score) {
  if (score >= 75) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

export function buildFinancialExposure(metric, matchImpact, digitalTwin = null) {
  const overallRisk = Number(metric?.overallRisk || 0);
  const injuryRisk = Number(metric?.injuryRisk || 0);
  const fatigueScore = Number(metric?.fatigueScore || 0);
  const heatFactor = Number(digitalTwin?.heatFactor || 1);
  const injurySensitivity = Number(digitalTwin?.injurySensitivity || 1);

  const riskPressure = clamp(overallRisk * 0.42 + injuryRisk * 0.38 + fatigueScore * 0.2, 0, 100);
  const matchLossPressure = clamp(matchImpact?.continueFiveMinutes?.projectedRisk || overallRisk, 0, 100);

  const estimatedInjuryCost = roundNumber(
    22000 + riskPressure * 680 + injurySensitivity * 9000 + heatFactor * 4200
  );
  const expectedAbsenceDays = roundNumber(2 + riskPressure * 0.21 + injurySensitivity * 4.8, 1);
  const matchValueLoss = roundNumber(6000 + matchLossPressure * 310 + (riskPressure - 30) * 70);

  const decisionDiff = Number(matchImpact?.deltaWinProbability || 0);
  const expectedCost30Days = roundNumber(
    estimatedInjuryCost * 0.45 + matchValueLoss * 0.6 + expectedAbsenceDays * 900 - decisionDiff * 430
  );

  const exposureScore = clamp(riskPressure * 0.7 + expectedAbsenceDays * 1.4, 0, 100);

  return {
    estimatedInjuryCost,
    expectedAbsenceDays,
    matchValueLoss,
    expectedCost30Days,
    exposureScore: roundNumber(exposureScore, 1),
    classification: toClassification(exposureScore)
  };
}
