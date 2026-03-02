function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function estimateFinancialExposure(baseExposure, risk) {
  const ratio = clamp(risk / 100, 0, 1);
  return Math.round(baseExposure * (0.58 + ratio * 0.7));
}

export function buildDecisionScenarios(metric) {
  if (!metric) return [];

  const baseRisk = Number(metric.overallRisk || 0);
  const baseWin = Number(metric.impact?.continueWinProbability || 56);
  const baseExposure = Number(metric.financialExposure?.expectedCost30Days || 0);
  const escalation = Math.max(0.04, Number(metric.escalationRate || 0.08));

  const scenarios = [
    {
      key: 'stay_now',
      label: 'استمرار بدون تدخل',
      summary: 'يحافظ على الخطة الحالية مع أعلى تصاعد للمخاطر.',
      riskAfter5: clamp(baseRisk + escalation * 300),
      winAfter5: clamp(baseWin - 2.4),
      confidence: 61
    },
    {
      key: 'reduce_load',
      label: 'خفض الشدة 20%',
      summary: 'تقليل الحمل البدني فورًا مع استقرار تكتيكي.',
      riskAfter5: clamp(baseRisk - 8 + escalation * 130),
      winAfter5: clamp(baseWin + 0.7),
      confidence: 74
    },
    {
      key: 'cool_hydrate',
      label: 'تبريد + ترطيب موجه',
      summary: 'تحسين حراري سريع وتقليل مخاطر الإجهاد الداخلي.',
      riskAfter5: clamp(baseRisk - 10.5 + escalation * 95),
      winAfter5: clamp(baseWin + 1.2),
      confidence: 77
    },
    {
      key: 'substitute_now',
      label: 'تبديل وقائي فوري',
      summary: 'أفضل خفض مخاطر على المدى القصير مع حماية اللاعب.',
      riskAfter5: clamp(baseRisk - 16 + escalation * 50),
      winAfter5: clamp(baseWin + 1.9),
      confidence: 82
    }
  ].map((item) => {
    const projectedExposure = estimateFinancialExposure(baseExposure, item.riskAfter5);
    return {
      ...item,
      riskAfter5: round(item.riskAfter5),
      winAfter5: round(item.winAfter5),
      projectedExposure,
      deltaRisk: round(baseRisk - item.riskAfter5),
      deltaWin: round(item.winAfter5 - baseWin)
    };
  });

  return scenarios.sort((a, b) => {
    const scoreA = a.deltaRisk * 0.65 + a.deltaWin * 8;
    const scoreB = b.deltaRisk * 0.65 + b.deltaWin * 8;
    return scoreB - scoreA;
  });
}
