import { useMemo } from 'react';
import { useSimulation } from '../utils/SimulationContext.jsx';

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

export default function FinancialRisk() {
  const { selectedMetric } = useSimulation();

  const roi = useMemo(() => {
    if (!selectedMetric) return 0;
    const stayCost = selectedMetric.financialExposure.expectedCost30Days;
    const subCost = Math.max(0, stayCost - selectedMetric.impact.financialExposure * 0.22);
    return stayCost - subCost;
  }, [selectedMetric]);

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>المخاطر المالية</h1>
        <p>تحليل تكلفة المخاطر الحالية وعائد التبديل الوقائي خلال 30 يومًا.</p>
      </header>

      <div className="financial-grid">
        <article className="card">
          <h3>تعرض 30 يوم</h3>
          <div className="kpi-number number">
            ر.س {Math.round(selectedMetric?.financialExposure?.expectedCost30Days || 0).toLocaleString('ar-SA')}
          </div>
          <p className="muted">التكلفة الإجمالية المتوقعة على مسار المخاطر الحالي.</p>
        </article>

        <article className="card">
          <h3>توقع تكلفة الإصابة</h3>
          <div className="metric-line">
            <span className="muted">تكلفة الإصابة المحتملة</span>
            <strong>
              ر.س {Math.round(selectedMetric?.financialExposure?.estimatedInjuryCost || 0).toLocaleString('ar-SA')}
            </strong>
          </div>
          <div className="metric-line">
            <span className="muted">خسارة قيمة المباراة</span>
            <strong>
              ر.س {Math.round(selectedMetric?.financialExposure?.matchValueLoss || 0).toLocaleString('ar-SA')}
            </strong>
          </div>
          <div className="metric-line">
            <span className="muted">أيام الغياب المتوقعة</span>
            <strong>{round(selectedMetric?.financialExposure?.expectedAbsenceDays)} يوم</strong>
          </div>
        </article>

        <article className="card">
          <h3>العائد من التبديل</h3>
          <div className="kpi-number number">ر.س {Math.round(roi).toLocaleString('ar-SA')}</div>
          <p className="muted">قيمة مالية محفوظة عند تطبيق توصية التبديل الآن.</p>
          <div className="metric-line">
            <span className="muted">فرق احتمالية الفوز</span>
            <strong>{round(selectedMetric?.impact?.deltaWinProbability)}%</strong>
          </div>
        </article>
      </div>
    </section>
  );
}
