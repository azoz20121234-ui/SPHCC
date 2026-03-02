function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function recommendationByRisk(risk) {
  if (risk > 70) {
    return {
      key: 'substitute_now',
      label: 'تبديل وقائي فوري',
      reason: 'المخاطر تجاوزت 70 وتقترب من نقطة الانهيار البدني.',
      confidence: 82
    };
  }

  if (risk >= 55) {
    return {
      key: 'monitor_3m',
      label: 'مراقبة دقيقة خلال 3 دقائق',
      reason: 'المخاطر متوسطة مرتفعة وتتطلب تقييمًا لحظيًا سريعًا.',
      confidence: 68
    };
  }

  return {
    key: 'safe_continue',
    label: 'استمرار آمن',
    reason: 'المؤشرات الحالية ضمن النطاق التشغيلي الآمن.',
    confidence: 91
  };
}

export function generateAiDecision(metric, impactPayload = null) {
  const risk = Number(metric?.overallRisk || 0);
  const rec = recommendationByRisk(risk);
  const winNow =
    Number(impactPayload?.impact?.continueFiveMinutes?.winProbability) ||
    clamp(64 - risk * 0.34, 8, 92);
  const winAfter =
    Number(impactPayload?.impact?.substituteNow?.winProbability) ||
    clamp(winNow + (risk > 70 ? 2.1 : 1.1), 8, 94);

  return {
    bestDecision: {
      key: rec.key,
      label: rec.label,
      description: rec.reason
    },
    confidence: rec.confidence,
    aiCoachLine: `${rec.label} - ${rec.reason}`,
    projectedRiskImpact: {
      reduction: round(clamp(14 + risk * 0.18, 6, 34)),
      nextRisk: round(clamp(risk - (14 + risk * 0.18), 0, 100))
    },
    projectedWinImpact: {
      delta: round(winAfter - winNow),
      winProbabilityNow: round(winNow),
      winProbabilityAfterDecision: round(winAfter)
    },
    candidates: [
      {
        key: 'substitute_now',
        label: 'تبديل فوري',
        description: 'خفض المخاطر بسرعة مع تغيير تكتيكي مباشر.',
        suitability: round(clamp(risk + 12, 30, 98))
      },
      {
        key: 'reduce_intensity',
        label: 'خفض الشدة',
        description: 'تقليل الأحمال العالية خلال الدقائق القادمة.',
        suitability: round(clamp(86 - risk * 0.37, 22, 92))
      },
      {
        key: 'continue_monitor',
        label: 'استمرار مع مراقبة',
        description: 'الاستمرار مع مراقبة دقيقة كل دقيقة.',
        suitability: round(clamp(78 - risk * 0.44, 16, 88))
      }
    ]
  };
}
