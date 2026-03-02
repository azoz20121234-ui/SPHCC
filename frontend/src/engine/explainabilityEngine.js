function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

const MODEL_FACTORS = [
  { key: 'fatigue', label: 'الإجهاد البدني', weight: 0.4 },
  { key: 'neural', label: 'الحمل العصبي', weight: 0.3 },
  { key: 'heat', label: 'الإجهاد الحراري', weight: 0.2 },
  { key: 'hydration', label: 'نقص الترطيب', weight: 0.1 }
];

function factorValue(metric, key) {
  if (key === 'fatigue') return Number(metric?.fatigueScore || 0);
  if (key === 'neural') return Number(metric?.neuralLoad || 0);
  if (key === 'heat') return Number(metric?.heatStress || 0);
  if (key === 'hydration') return clamp(100 - Number(metric?.hydration || 0));
  return 0;
}

export function buildExplainabilitySnapshot(metric, twin, aiDecision) {
  if (!metric) {
    return {
      contributions: [],
      sensitivity: [],
      narrative: []
    };
  }

  const baseRisk = Number(metric.overallRisk || 0);
  const baseWin = Number(aiDecision?.projectedWinImpact?.winProbabilityNow || metric.impact?.continueWinProbability || 55);

  const raw = MODEL_FACTORS.map((factor) => {
    const value = factorValue(metric, factor.key);
    const weighted = value * factor.weight;
    return {
      ...factor,
      value: round(value),
      weighted
    };
  });
  const totalWeighted = raw.reduce((sum, item) => sum + item.weighted, 0) || 1;

  const contributions = raw.map((item) => ({
    ...item,
    share: round((item.weighted / totalWeighted) * 100)
  }));

  const sensitivity = contributions
    .map((item) => {
      const deltaRisk = round(10 * item.weight, 2);
      const deltaWin = round(-deltaRisk * 0.18, 2);
      return {
        key: item.key,
        label: item.label,
        deltaRisk,
        deltaWin,
        riskIfUp10: round(clamp(baseRisk + deltaRisk)),
        winIfUp10: round(clamp(baseWin + deltaWin, 0, 100), 2)
      };
    })
    .sort((a, b) => b.deltaRisk - a.deltaRisk);

  const narrative = [
    `العامل الأكثر تأثيرًا حاليًا: ${sensitivity[0]?.label || 'غير متاح'}.`,
    `رفع ${sensitivity[0]?.label || 'العامل الرئيسي'} بنسبة 10% يضيف تقريبًا ${sensitivity[0]?.deltaRisk || 0}% إلى المخاطر.`,
    `خصائص اللاعب الشخصية تؤثر على الاستجابة: سرعة التعافي ${round(twin?.recoveryRate, 2)}، الحساسية العصبية ${round(twin?.neuralSensitivity, 2)}، تحمل الحرارة ${round(twin?.heatTolerance, 2)}.`
  ];

  return { contributions, sensitivity, narrative };
}
