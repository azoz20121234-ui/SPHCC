function buildRiskClass(score) {
  if (score >= 70) return { label: 'مرتفع', className: 'high' };
  if (score >= 40) return { label: 'متوسط', className: 'medium' };
  return { label: 'منخفض', className: 'low' };
}

export default function ExecutiveView({
  overview,
  dashboard,
  selectedMetric,
  playerProfile,
  financialExposure,
  fmtNum,
  fmtTime
}) {
  const exposure = financialExposure?.exposure || null;
  const financialRisk = buildRiskClass(Number(exposure?.exposureScore || dashboard.avgRisk || 0));
  const estimatedInjuryCost = Math.round(Number(exposure?.estimatedInjuryCost || 0));

  const kpis = [
    {
      key: 'teamReadiness',
      label: 'جاهزية الفريق',
      value: fmtNum(dashboard.teamReadiness),
      trend: `${Number(dashboard.teamReadiness || 0) >= 70 ? '↑' : '↓'} مؤشر الاستعداد العام`
    },
    {
      key: 'avgRisk',
      label: 'متوسط المخاطر',
      value: fmtNum(dashboard.avgRisk),
      trend: `${Number(dashboard.avgRisk || 0) < 40 ? '↓' : '↑'} مقارنة بحد الأمان`
    },
    {
      key: 'activeAlerts',
      label: 'التنبيهات النشطة',
      value: dashboard.activeAlerts,
      trend: `${Number(dashboard.activeAlerts || 0) <= 2 ? '↓' : '↑'} العبء الطبي المباشر`
    },
    {
      key: 'interventions',
      label: 'التدخلات المعلقة',
      value: dashboard.interventionBacklog,
      trend: `${Number(dashboard.interventionBacklog || 0) <= 3 ? '↓' : '↑'} سرعة الاستجابة`
    }
  ];

  const bioSignature = playerProfile?.digitalTwin || null;
  const bioRows = bioSignature
    ? [
        {
          label: 'سرعة التعافي',
          value: bioSignature.recoverySpeed,
          hint: 'كلما ارتفع المؤشر زادت سرعة الاستشفاء'
        },
        {
          label: 'حساسية الإصابة',
          value: bioSignature.injurySensitivity,
          hint: 'ارتفاعه يعني تأثرًا أكبر بالأحمال المفاجئة'
        },
        {
          label: 'معامل الإرهاق العصبي',
          value: bioSignature.neuralFatigueFactor,
          hint: 'يقيس سرعة تراكم الإجهاد الذهني والحركي'
        },
        {
          label: 'معامل الحرارة',
          value: bioSignature.heatFactor,
          hint: 'حساسية اللاعب للإجهاد الحراري أثناء المباراة'
        }
      ]
    : [];

  return (
    <section className="executive-premium fade-in">
      <article className="exec-hero card glass">
        <div>
          <h2>الوضع التنفيذي</h2>
          <h3>مركز القرار الصحي الرياضي</h3>
          <p>
            لقطة تنفيذية فورية لسلامة الفريق، المخاطر التشغيلية، والتكلفة الطبية المتوقعة خلال
            الجلسة الحالية.
          </p>
        </div>
        <div className="hero-meta">
          <span>آخر تحديث حي</span>
          <strong>{fmtTime(selectedMetric?.createdAt || dashboard.latestMetricAt)}</strong>
        </div>
      </article>

      <section className="exec-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.key} className="card glass kpi-card">
            <h4>{kpi.label}</h4>
            <strong>{kpi.value}</strong>
            <hr />
            <small>{kpi.trend}</small>
          </article>
        ))}
      </section>

      <section className="exec-panels">
        <article className="card glass exec-summary">
          <h4>الملخص التنفيذي</h4>
          <p>
            مستوى الجاهزية الحالي للفريق: <b>{fmtNum(overview.teamReadiness)}</b>. أعلى خطر حالي لدى
            اللاعب: <b>{overview.hotRiskList?.[0]?.playerName || 'غير متاح'}</b> مع مؤشر
            <b> {fmtNum(overview.hotRiskList?.[0]?.overallRisk)}</b>.
          </p>
          <ul>
            {(overview.readinessBoard || []).slice(0, 4).map((item) => (
              <li key={item.playerId}>
                <span>{item.playerName}</span>
                <strong>{fmtNum(item.readiness)}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="card glass financial-panel">
          <h4>المخاطر المالية</h4>
          <div className="money">ر.س {estimatedInjuryCost.toLocaleString('ar-SA')}</div>
          <p>التكلفة المتوقعة خلال 30 يوم: ر.س {(exposure?.expectedCost30Days || 0).toLocaleString('ar-SA')}</p>
          <ul className="financial-kpis">
            <li>
              <span>أيام الغياب المتوقعة</span>
              <strong>{fmtNum(exposure?.expectedAbsenceDays)}</strong>
            </li>
            <li>
              <span>خسارة قيمة المباراة</span>
              <strong>ر.س {(exposure?.matchValueLoss || 0).toLocaleString('ar-SA')}</strong>
            </li>
          </ul>
          <div className={`risk-chip ${financialRisk.className}`}>
            تصنيف المخاطر: {exposure?.classification || financialRisk.label}
          </div>
        </article>
      </section>

      <section className="exec-panels">
        <article className="card glass bio-panel">
          <h4>البصمة البيولوجية للاعب</h4>
          {bioSignature ? (
            <>
              <p className="muted">
                ملف السمات الرقمية: <b>{playerProfile?.player?.name}</b>
              </p>
              <ul>
                {bioRows.map((item) => (
                  <li key={item.label}>
                    <div>
                      <span>{item.label}</span>
                      <small>{item.hint}</small>
                    </div>
                    <strong>{fmtNum(item.value)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">اختر لاعبًا لعرض بصمته البيولوجية الرقمية.</p>
          )}
        </article>
      </section>

      <footer className="exec-footer">طبقة الذكاء التنفيذي - SPHCC</footer>
    </section>
  );
}
