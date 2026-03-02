function serviceStatus(metric) {
  const risk = Number(metric?.overallRisk || 0);
  return [
    {
      key: 'preventive_sub',
      label: 'Preventive Substitution',
      status: risk >= 70 ? 'نشط' : 'جاهز',
      note: 'يتابع نافذة التبديل الوقائي بشكل لحظي.'
    },
    {
      key: 'heatshield',
      label: 'HeatShield Protocol',
      status: Number(metric?.hydrationRisk || 0) >= 55 ? 'نشط' : 'جاهز',
      note: 'يبني خطة تبريد وترطيب حسب الحمل الحراري.'
    },
    {
      key: 'budget_guard',
      label: 'Budget Guard',
      status: risk >= 65 ? 'تنبيه' : 'مستقر',
      note: 'يتوقع التعرض المالي ويضبط أولويات القرار.'
    }
  ];
}

export default function SmartServicesPanel({ selectedMetric }) {
  const services = serviceStatus(selectedMetric);

  return (
    <section className="panel services-panel layout-col-1">
      <h2>خدمات المنصة الذكية</h2>
      <ul className="list clean">
        {services.map((service) => (
          <li key={service.key}>
            <div>
              <strong>{service.label}</strong>
              <span>{service.note}</span>
            </div>
            <em className="service-status">{service.status}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}
