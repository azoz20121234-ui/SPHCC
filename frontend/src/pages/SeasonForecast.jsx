export default function SeasonForecast() {
  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>توقع الموسم</h1>
        <p>تحليل ذروة الإجهاد ونوافذ الراحة الموصى بها عبر الموسم.</p>
      </header>
      <div className="season-grid">
        <article className="card">
          <h3>منحنى الإجهاد</h3>
          <p>اتجاه الحمل البدني عبر المباريات القادمة.</p>
        </article>
        <article className="card">
          <h3>خريطة احتمالية الإصابة</h3>
          <p>تقدير التعرض لكل مباراة ضمن خطة الموسم.</p>
        </article>
        <article className="card">
          <h3>نوافذ الراحة الموصى بها</h3>
          <p>توقيتات الاستشفاء المثلى لتقليل المخاطر.</p>
        </article>
      </div>
    </section>
  );
}
