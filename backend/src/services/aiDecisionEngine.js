function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAcceleration(acceleration) {
  return clamp(((Number(acceleration) - 0.7) / (5.5 - 0.7)) * 100);
}

function computeHeatRisk({ temperature, hydrationRisk }) {
  const tempFactor = clamp((Number(temperature) - 36.7) * 33);
  const hydrationFactor = Number(hydrationRisk || 0) * 0.58;
  return Number(clamp(tempFactor + hydrationFactor).toFixed(1));
}

function computeNeuralLoad({ fatigueScore, acceleration, sleepHours }) {
  const accelerationFactor = normalizeAcceleration(acceleration) * 0.38;
  const fatigueFactor = Number(fatigueScore || 0) * 0.44;
  const sleepDebt = clamp((8 - Number(sleepHours || 0)) * 14);
  return Number(clamp(fatigueFactor + accelerationFactor + sleepDebt).toFixed(1));
}

function decisionCatalog() {
  return [
    {
      key: 'substitute_now',
      label: 'تبديل فوري',
      description: 'إخراج اللاعب فورًا لحماية حالته الصحية وتقليل احتمالية الإصابة الحرجة.',
      riskReductionBase: 28,
      winDeltaBase: -2
    },
    {
      key: 'reduce_intensity',
      label: 'خفض الشدة',
      description: 'خفض الحمل الحركي والتسارع العالي مع إبقاء اللاعب في الملعب.',
      riskReductionBase: 16,
      winDeltaBase: 4
    },
    {
      key: 'hydrate_and_cool',
      label: 'ترطيب وتبريد',
      description: 'تطبيق بروتوكول ترطيب وتبريد سريع قبل تصعيد الحالة.',
      riskReductionBase: 13,
      winDeltaBase: 2
    },
    {
      key: 'hold_and_monitor',
      label: 'استمرار مع مراقبة',
      description: 'الاستمرار الحالي مع مراقبة دقيقة كل دقيقتين.',
      riskReductionBase: 6,
      winDeltaBase: 6
    }
  ];
}

function scoreDecision(decision, inputs) {
  const { fatigueScore, injuryRisk, heatRisk, neuralLoad, overallRisk } = inputs;

  let suitability = 0;

  if (decision.key === 'substitute_now') {
    suitability = overallRisk * 0.55 + injuryRisk * 0.35 + neuralLoad * 0.1;
  } else if (decision.key === 'reduce_intensity') {
    suitability = fatigueScore * 0.34 + neuralLoad * 0.38 + injuryRisk * 0.2 + heatRisk * 0.08;
  } else if (decision.key === 'hydrate_and_cool') {
    suitability = heatRisk * 0.5 + fatigueScore * 0.22 + neuralLoad * 0.2 + injuryRisk * 0.08;
  } else {
    suitability = (100 - overallRisk) * 0.5 + (100 - injuryRisk) * 0.25 + (100 - heatRisk) * 0.25;
  }

  return Number(clamp(suitability).toFixed(1));
}

export function runDecisionEngine(metric) {
  const fatigueScore = Number(metric?.fatigueScore || 0);
  const injuryRisk = Number(metric?.injuryRisk || 0);
  const hydrationRisk = Number(metric?.hydrationRisk || 0);
  const overallRisk = Number(metric?.overallRisk || 0);
  const heatRisk = computeHeatRisk({
    temperature: metric?.temperature,
    hydrationRisk
  });
  const neuralLoad = computeNeuralLoad({
    fatigueScore,
    acceleration: metric?.acceleration,
    sleepHours: metric?.sleepHours
  });

  const inputs = {
    fatigueScore,
    injuryRisk,
    heatRisk,
    neuralLoad,
    overallRisk
  };

  const candidates = decisionCatalog().map((item) => {
    const suitability = scoreDecision(item, inputs);

    const riskImpact =
      item.riskReductionBase + overallRisk * 0.06 + (item.key === 'hydrate_and_cool' ? heatRisk * 0.1 : 0);

    const winImpact =
      item.winDeltaBase +
      (item.key === 'substitute_now' ? -(fatigueScore * 0.02) : 0) +
      (item.key === 'reduce_intensity' ? neuralLoad * 0.04 : 0) +
      (item.key === 'hold_and_monitor' ? -(overallRisk * 0.03) : 0);

    return {
      ...item,
      suitability,
      projectedRiskReduction: Number(clamp(riskImpact, -40, 55).toFixed(1)),
      projectedWinProbabilityDelta: Number(clamp(winImpact, -20, 20).toFixed(1))
    };
  });

  candidates.sort((a, b) => b.suitability - a.suitability);

  const best = candidates[0];
  const second = candidates[1] || { suitability: 0 };
  const confidence = clamp(55 + (best.suitability - second.suitability) * 1.4, 55, 97);

  return {
    inputs,
    bestDecision: {
      key: best.key,
      label: best.label,
      description: best.description
    },
    confidence: Number(confidence.toFixed(1)),
    projectedRiskImpact: {
      reduction: best.projectedRiskReduction,
      nextRisk: Number(clamp(overallRisk - best.projectedRiskReduction).toFixed(1))
    },
    projectedWinImpact: {
      delta: best.projectedWinProbabilityDelta,
      winProbabilityNow: Number(clamp(62 - overallRisk * 0.28 + fatigueScore * 0.05, 15, 90).toFixed(1)),
      winProbabilityAfterDecision: Number(
        clamp(62 - overallRisk * 0.28 + fatigueScore * 0.05 + best.projectedWinProbabilityDelta, 15, 92).toFixed(1)
      )
    },
    candidates
  };
}
