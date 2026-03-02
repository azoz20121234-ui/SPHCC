function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toFixedNumber(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function computeBaselineWinProbability(metric) {
  const overallRisk = Number(metric?.overallRisk || 0);
  const fatigueScore = Number(metric?.fatigueScore || 0);
  const injuryRisk = Number(metric?.injuryRisk || 0);
  const hydrationRisk = Number(metric?.hydrationRisk || 0);

  return clamp(68 - overallRisk * 0.34 - injuryRisk * 0.11 + fatigueScore * 0.05 - hydrationRisk * 0.04, 12, 91);
}

function computeEscalationPerMinute(metric, digitalTwin) {
  const fatigueScore = Number(metric?.fatigueScore || 0);
  const acceleration = Number(metric?.acceleration || 0);
  const temperature = Number(metric?.temperature || 0);
  const neuralFactor = Number(digitalTwin?.neuralFatigueFactor || 1);
  const heatFactor = Number(digitalTwin?.heatFactor || 1);
  const injurySensitivity = Number(digitalTwin?.injurySensitivity || 1);

  const accelerationPressure = clamp((acceleration - 1.1) * 2.2, 0, 10);
  const thermalPressure = clamp((temperature - 37.2) * 6.4, 0, 14) * heatFactor;
  const fatiguePressure = fatigueScore * 0.05 * neuralFactor;

  return clamp((accelerationPressure + thermalPressure + fatiguePressure) * injurySensitivity * 0.22, 0.6, 6.8);
}

export function buildMatchImpact(metric, digitalTwin = null) {
  const baseRisk = Number(metric?.overallRisk || 0);
  const baseWinProbability = computeBaselineWinProbability(metric);
  const escalationPerMinute = computeEscalationPerMinute(metric, digitalTwin);
  const recoverySpeed = Number(digitalTwin?.recoverySpeed || 1);

  const riskEscalationCurve = [];
  for (let minute = 0; minute <= 5; minute += 1) {
    const continueRisk = clamp(baseRisk + escalationPerMinute * minute, 0, 99);
    const substituteRisk = clamp(baseRisk - (12 + recoverySpeed * 9) + minute * 0.42, 0, 99);
    riskEscalationCurve.push({
      minute,
      continueRisk: toFixedNumber(continueRisk),
      substituteRisk: toFixedNumber(substituteRisk),
      deltaRisk: toFixedNumber(continueRisk - substituteRisk)
    });
  }

  const continueRisk5 = riskEscalationCurve[5].continueRisk;
  const substituteRisk5 = riskEscalationCurve[5].substituteRisk;

  const continueWinProbability = clamp(baseWinProbability - escalationPerMinute * 1.12, 8, 90);
  const substituteWinProbability = clamp(
    baseWinProbability - 1.5 + (baseRisk - substituteRisk5) * 0.12 + recoverySpeed * 1.2,
    10,
    91
  );

  return {
    baseline: {
      risk: toFixedNumber(baseRisk),
      winProbability: toFixedNumber(baseWinProbability)
    },
    continueFiveMinutes: {
      label: 'استمرار اللاعب 5 دقائق',
      projectedRisk: toFixedNumber(continueRisk5),
      riskDelta: toFixedNumber(continueRisk5 - baseRisk),
      winProbability: toFixedNumber(continueWinProbability)
    },
    substituteNow: {
      label: 'تبديل اللاعب الآن',
      projectedRisk: toFixedNumber(substituteRisk5),
      riskDelta: toFixedNumber(substituteRisk5 - baseRisk),
      winProbability: toFixedNumber(substituteWinProbability)
    },
    deltaWinProbability: toFixedNumber(substituteWinProbability - continueWinProbability),
    riskEscalationCurve
  };
}
