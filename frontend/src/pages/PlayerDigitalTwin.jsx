import { useParams } from 'react-router-dom';

export default function PlayerDigitalTwin() {
  const { id } = useParams();

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>التوأم الرقمي للاعب</h1>
        <p>نموذج فسيولوجي شخصي للاعب رقم {id} لتوقع المخاطر والاستجابة.</p>
      </header>
      <div className="page-grid cols-3">
        <article className="card">
          <h3>الخط الصحي الأساسي</h3>
          <p>مؤشرات الاستقرار الحيوي والجاهزية المرجعية.</p>
        </article>
        <article className="card">
          <h3>سرعة التعافي والحساسية العصبية</h3>
          <p>خصائص استجابة اللاعب للأحمال المرتفعة.</p>
        </article>
        <article className="card">
          <h3>تحمل الحرارة ونموذج المخاطر</h3>
          <p>بصمة حرارية فردية ومنحنى مخاطر ديناميكي.</p>
        </article>
      </div>
    </section>
  );
}
