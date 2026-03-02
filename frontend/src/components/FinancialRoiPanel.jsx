export default function FinancialRoiPanel({ playerRows, sessionProjection }) {
  return (
    <section className="card financial-roi">
      <h3>محرك ROI التنبؤي</h3>
      <p className="muted">تقييم العائد الوقائي لكل لاعب ولكل أفق زمني.</p>

      <div className="roi-horizons">
        {sessionProjection.map((item) => (
          <article key={item.key} className="roi-chip">
            <strong>{item.label}</strong>
            <span>تكلفة الاستمرار: ر.س {item.stayCost.toLocaleString('ar-SA')}</span>
            <span>العائد الصافي: ر.س {item.net.toLocaleString('ar-SA')}</span>
            <span>ROI: {item.roi}%</span>
          </article>
        ))}
      </div>

      <div className="roi-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>اللاعب</th>
              <th>تعرض 30 يوم</th>
              <th>تكلفة الوقاية</th>
              <th>الوفر المتوقع</th>
              <th>ROI</th>
              <th>أولوية التدخل</th>
            </tr>
          </thead>
          <tbody>
            {playerRows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.playerName}</td>
                <td>ر.س {row.baselineExposure.toLocaleString('ar-SA')}</td>
                <td>ر.س {row.preventionCost.toLocaleString('ar-SA')}</td>
                <td>ر.س {row.savings.toLocaleString('ar-SA')}</td>
                <td>{row.roi}%</td>
                <td>{row.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
