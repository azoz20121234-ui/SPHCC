function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function interventionCost(metric) {
  const risk = Number(metric?.overallRisk || 0);
  const hydrationRisk = Number(metric?.hydrationRisk || 0);
  return Math.round(7000 + risk * 85 + hydrationRisk * 26);
}

function mitigationRatio(metric) {
  const risk = Number(metric?.overallRisk || 0);
  return clamp(0.16 + risk / 300, 0.16, 0.48);
}

export function buildPlayerRoiRows(players, metricsByPlayer) {
  return (players || [])
    .map((player) => {
      const metric = metricsByPlayer?.[player.id];
      if (!metric) return null;

      const baselineExposure = Number(metric.financialExposure?.expectedCost30Days || 0);
      const preventionCost = interventionCost(metric);
      const savings = Math.round(baselineExposure * mitigationRatio(metric));
      const net = savings - preventionCost;
      const roi = preventionCost > 0 ? (net / preventionCost) * 100 : 0;
      const paybackDays = savings > 0 ? Math.max(1, Math.round(preventionCost / (savings / 30))) : 30;

      return {
        playerId: player.id,
        playerName: player.name,
        baselineExposure,
        preventionCost,
        savings,
        net,
        roi: round(roi),
        paybackDays,
        risk: round(metric.overallRisk),
        priority:
          roi >= 60 && metric.overallRisk >= 65
            ? 'عالية'
            : roi >= 25
              ? 'متوسطة'
              : 'منخفضة'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.roi - a.roi);
}

export function buildSessionRoiProjection(metric) {
  if (!metric) return [];

  const baseline30 = Number(metric.financialExposure?.expectedCost30Days || 0);
  const preventionCost = interventionCost(metric);
  const ratio = mitigationRatio(metric);
  const winDelta = Number(metric.impact?.deltaWinProbability || 0);

  const horizons = [
    { key: 'h5', label: 'خلال 5 دقائق', factor: 0.08 },
    { key: 'h15', label: 'حتى نهاية الشوط', factor: 0.26 },
    { key: 'h30d', label: 'خلال 30 يوم', factor: 1 }
  ];

  return horizons.map((horizon) => {
    const stayCost = Math.round(baseline30 * horizon.factor);
    const preventedLoss = Math.round(stayCost * ratio);
    const actionCost = Math.round(preventionCost * horizon.factor);
    const net = preventedLoss - actionCost;
    const roi = actionCost > 0 ? (net / actionCost) * 100 : 0;

    return {
      ...horizon,
      stayCost,
      actionCost,
      preventedLoss,
      net,
      roi: round(roi),
      winImpact: round(winDelta * horizon.factor, 2)
    };
  });
}
