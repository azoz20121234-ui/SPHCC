function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateReadiness(metric) {
  if (!metric) return 0;
  const base = 100 - Number(metric.overallRisk || 0);
  const fatiguePenalty = Number(metric.fatigueScore || 0) * 0.18;
  const hydrationPenalty = Number(metric.hydrationRisk || 0) * 0.14;
  const injuryPenalty = Number(metric.injuryRisk || 0) * 0.2;
  return Number(clamp(base - fatiguePenalty - hydrationPenalty - injuryPenalty + 18, 0, 100).toFixed(1));
}

export function buildInterventionDrafts(metric) {
  if (!metric) return [];

  const drafts = [];
  const add = (protocolKey, title, rationale, priority) => {
    drafts.push({ protocolKey, title, rationale, priority });
  };

  if (Number(metric.overallRisk) >= 80) {
    add(
      'emergency_substitution',
      'تبديل وقائي فوري',
      'المخاطر الكلية تجاوزت الحد الحرج، يوصى بتبديل اللاعب لحمايته من إصابة حادة.',
      95
    );
  }

  if (Number(metric.injuryRisk) >= 70) {
    add(
      'biomechanics_scan',
      'فحص حركي فوري',
      'خطر الإصابة مرتفع؛ يلزم فحص نمط الحركة وعدم التماثل العضلي قبل الاستمرار.',
      86
    );
  }

  if (Number(metric.hydrationRisk) >= 60) {
    add(
      'rapid_rehydration',
      'بروتوكول ترطيب سريع',
      'تم رصد علامات جفاف مؤثرة على الأداء والاستشفاء، يلزم تدخل ترطيب مباشر.',
      78
    );
  }

  if (Number(metric.fatigueScore) >= 68) {
    add(
      'load_management',
      'خفض الحمل البدني',
      'الإجهاد مرتفع؛ يوصى بخفض التسارع والركض عالي الشدة خلال الدقائق القادمة.',
      74
    );
  }

  if (Number(metric.temperature) >= 38.7) {
    add(
      'cooling_protocol',
      'بروتوكول تبريد فوري',
      'حرارة الجسم مرتفعة؛ يوصى بتبريد فوري وإعادة تقييم خلال دقيقتين.',
      84
    );
  }

  const unique = new Map();
  drafts.forEach((item) => {
    if (!unique.has(item.protocolKey)) {
      unique.set(item.protocolKey, item);
    }
  });

  return [...unique.values()].sort((a, b) => b.priority - a.priority);
}

export function buildTacticalAdvice(metric) {
  if (!metric) {
    return ['لا توجد بيانات كافية لإنتاج توصية تكتيكية.'];
  }

  const advice = [];

  if (Number(metric.overallRisk) >= 80) {
    advice.push('اتخاذ قرار تبديل وقائي فوري ومنع أحمال انفجارية إضافية.');
  } else if (Number(metric.overallRisk) >= 60) {
    advice.push('تحويل اللاعب لدور تكتيكي أقل استهلاكًا للطاقة لمدة 5-8 دقائق.');
  } else {
    advice.push('الحفاظ على الخطة الحالية مع مراقبة مستمرة كل دقيقتين.');
  }

  if (Number(metric.hydrationRisk) >= 60) {
    advice.push('طلب توقف قصير للترطيب مع خفض كثافة الضغط العالي مؤقتًا.');
  }

  if (Number(metric.injuryRisk) >= 70) {
    advice.push('تجنب الالتحامات المباشرة وفرض تغطية مزدوجة لحماية اللاعب.');
  }

  if (Number(metric.fatigueScore) >= 70) {
    advice.push('تقليل التسارعات العمودية وتدوير التمركز لتقليل الحمل العضلي.');
  }

  return advice;
}

export function buildCompetitiveOverview(latestPlayerMetrics, pendingInterventions) {
  const rows = latestPlayerMetrics.map((row) => {
    const readiness = calculateReadiness(row.metric);
    return {
      playerId: row.player.id,
      playerName: row.player.name,
      sport: row.player.sport,
      position: row.player.position,
      readiness,
      overallRisk: Number(row.metric?.overallRisk || 0),
      injuryRisk: Number(row.metric?.injuryRisk || 0),
      hydrationRisk: Number(row.metric?.hydrationRisk || 0),
      fatigueScore: Number(row.metric?.fatigueScore || 0),
      updatedAt: row.metric?.createdAt || null
    };
  });

  const teamReadiness =
    rows.length === 0
      ? 0
      : Number((rows.reduce((sum, item) => sum + item.readiness, 0) / rows.length).toFixed(1));

  return {
    teamReadiness,
    interventionBacklog: pendingInterventions.length,
    hotRiskList: [...rows].sort((a, b) => b.overallRisk - a.overallRisk).slice(0, 5),
    readinessBoard: [...rows].sort((a, b) => b.readiness - a.readiness),
    hydrationWatch: [...rows].sort((a, b) => b.hydrationRisk - a.hydrationRisk).slice(0, 5)
  };
}
