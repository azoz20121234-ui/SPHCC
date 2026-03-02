export default function FinancialRisk() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>المخاطر المالية</h1>
        <p>توقع التعرض المالي خلال 30 يومًا وتأثير قرارات التبديل الوقائي.</p>
      </header>
      <div className="financial-grid">
        <article className="card">
          <h3>تعرض 30 يوم</h3>
          <p>127,000 ريال متوقعة على المسار الحالي للمخاطر.</p>
        </article>
        <article className="card">
          <h3>توقع تكلفة الإصابة</h3>
          <p>مقارنة التكلفة بين الاستمرار والتبديل الفوري.</p>
        </article>
        <article className="card">
          <h3>العائد من التبديل</h3>
          <p>القيمة المالية المحفوظة عند تفعيل التدخل الوقائي.</p>
        </article>
      </div>
    </section>
  );
}
