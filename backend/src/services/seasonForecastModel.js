function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function wave(index, seed) {
  return Math.sin((index + 1) * 1.27 + seed * 0.19);
}

export function buildSeasonForecast(metric, digitalTwin = null, options = {}) {
  const totalMatches = Number(options.matches || 20);
  const seed = Number(metric?.playerId || 1);

  const baseFatigue = Number(metric?.fatigueScore || 38);
  const baseInjury = Number(metric?.injuryRisk || 32);
  const baseHydration = Number(metric?.hydrationRisk || 30);
  const baseTemp = Number(metric?.temperature || 37.1);

  const recoverySpeed = Number(digitalTwin?.recoverySpeed || 1);
  const injurySensitivity = Number(digitalTwin?.injurySensitivity || 1);
  const neuralFatigueFactor = Number(digitalTwin?.neuralFatigueFactor || 1);
  const heatFactor = Number(digitalTwin?.heatFactor || 1);

  const matches = [];
  for (let i = 1; i <= totalMatches; i += 1) {
    const cycleDrop = i % 6 === 0 ? 8.5 * recoverySpeed : 0;
    const fatigueTrend =
      baseFatigue +
      i * (1.65 + (neuralFatigueFactor - 1) * 1.45) +
      wave(i, seed) * 4.8 -
      cycleDrop;
    const heatStress = baseHydration * 0.35 + (baseTemp - 36.8) * 10.5 * heatFactor + wave(i + 2, seed) * 2.6;
    const injuryProbability =
      baseInjury * 0.42 +
      fatigueTrend * 0.44 +
      heatStress * 0.18 +
      injurySensitivity * 9.2 -
      recoverySpeed * 5.6;

    const fatigue = clamp(fatigueTrend, 18, 98);
    const heat = clamp(heatStress, 12, 95);
    const injury = clamp(injuryProbability, 8, 98);
    const restRecommended = injury >= 65 || fatigue >= 74;

    matches.push({
      match: i,
      fatigue: toNumber(fatigue),
      heatStress: toNumber(heat),
      injuryProbability: toNumber(injury),
      restRecommended,
      recommendation: restRecommended ? 'راحة/تدوير' : 'جاهز للمشاركة'
    });
  }

  const peak = matches.reduce((acc, row) => {
    const strain = row.fatigue * 0.64 + row.injuryProbability * 0.36;
    if (!acc || strain > acc.strain) {
      return { match: row.match, strain: toNumber(strain), injuryProbability: row.injuryProbability };
    }
    return acc;
  }, null);

  const restWindows = matches
    .filter((row) => row.restRecommended)
    .slice(0, 5)
    .map((row) => ({
      match: row.match,
      reason:
        row.injuryProbability >= 72
          ? 'احتمالية إصابة مرتفعة'
          : 'ذروة إجهاد تحتاج تدوير حمل'
    }));

  const avgInjuryProbability =
    matches.length === 0
      ? 0
      : matches.reduce((sum, row) => sum + row.injuryProbability, 0) / matches.length;

  return {
    totalMatches,
    avgInjuryProbability: toNumber(avgInjuryProbability),
    peakStrain: peak,
    bestRestWindows: restWindows,
    matches
  };
}
