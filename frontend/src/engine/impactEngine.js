function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

export function calculateImpact(risk, baselineWinProbability = 62) {
  const normalizedRisk = clamp(Number(risk || 0), 0, 100);
  const injuryProbability = normalizedRisk / 100;
  const winDeltaIfStay = -injuryProbability * 4;
  const winDeltaIfSub = 1.8;
  const financialExposure = injuryProbability * 250000 * 0.12;

  const continueWinProbability = clamp(Number(baselineWinProbability || 62) + winDeltaIfStay, 5, 95);
  const substituteWinProbability = clamp(Number(baselineWinProbability || 62) + winDeltaIfSub, 5, 95);

  return {
    risk: round(normalizedRisk, 1),
    injuryProbability: round(injuryProbability, 4),
    winDeltaIfStay: round(winDeltaIfStay, 2),
    winDeltaIfSub: round(winDeltaIfSub, 2),
    financialExposure: Math.round(financialExposure),
    continueWinProbability: round(continueWinProbability, 1),
    substituteWinProbability: round(substituteWinProbability, 1),
    deltaWinProbability: round(substituteWinProbability - continueWinProbability, 1)
  };
}

export function buildMatchImpactFromRisk(risk, baselineWinProbability = 62) {
  const impact = calculateImpact(risk, baselineWinProbability);
  const slope = clamp(impact.risk / 32, 0.6, 5.2);

  const riskEscalationCurve = Array.from({ length: 6 }).map((_, minute) => {
    const continueRisk = clamp(impact.risk + slope * minute);
    const substituteRisk = clamp(impact.risk - 12 + minute * 0.35);
    return {
      minute,
      continueRisk: round(continueRisk, 1),
      substituteRisk: round(substituteRisk, 1),
      deltaRisk: round(continueRisk - substituteRisk, 1)
    };
  });

  return {
    impact: {
      continueFiveMinutes: {
        label: 'استمرار اللاعب 5 دقائق',
        projectedRisk: riskEscalationCurve[5].continueRisk,
        winProbability: impact.continueWinProbability
      },
      substituteNow: {
        label: 'تبديل اللاعب الآن',
        projectedRisk: riskEscalationCurve[5].substituteRisk,
        winProbability: impact.substituteWinProbability
      },
      deltaWinProbability: impact.deltaWinProbability,
      injuryProbability: round(impact.injuryProbability * 100, 1),
      riskEscalationCurve
    }
  };
}

export function buildFinancialExposureFromRisk(risk) {
  const impact = calculateImpact(risk);
  const expectedAbsenceDays = clamp(impact.risk * 0.15, 1, 20);

  return {
    exposure: {
      estimatedInjuryCost: impact.financialExposure,
      expectedAbsenceDays: round(expectedAbsenceDays, 1),
      matchValueLoss: Math.round(impact.financialExposure * 0.65),
      expectedCost30Days: Math.round(impact.financialExposure * 1.35),
      exposureScore: round(impact.risk, 1),
      classification: impact.risk >= 75 ? 'مرتفع' : impact.risk >= 45 ? 'متوسط' : 'منخفض'
    }
  };
}
