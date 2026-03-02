export default function TacticalLive() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>البث التكتيكي المباشر</h1>
        <p>مساحة تشغيل لحظية لمتابعة قرارات المباراة الصحية.</p>
      </header>
      <div className="tactical-grid">
        <article className="card">
          <h3>القياسات الحية</h3>
          <p>تدفق لحظي لبيانات المحاكاة داخل المتصفح.</p>
        </article>
        <article className="card">
          <h3>التوقع الزمني</h3>
          <p>منحنى تصاعد المخاطر للعشر دقائق القادمة.</p>
        </article>
        <article className="card">
          <h3>خريطة الإجهاد</h3>
          <p>توزيع ضغط الإجهاد والحمل العصبي على مناطق الملعب.</p>
        </article>
      </div>
    </section>
  );
}
