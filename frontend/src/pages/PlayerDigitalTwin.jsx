import { useParams } from 'react-router-dom';

export default function PlayerDigitalTwin() {
  const { id } = useParams();

  return (
    <section className="page fade-in">
      <header className="page-header">
        <h1>Player Digital Twin</h1>
        <p>Personalized physiological model for player #{id}.</p>
      </header>
      <div className="page-grid cols-3">
        <article className="card"><h3>Baseline Health</h3><p>Resting and readiness baseline indicators.</p></article>
        <article className="card"><h3>Recovery & Neural Sensitivity</h3><p>Adaptive model factors for load response.</p></article>
        <article className="card"><h3>Heat Tolerance & Risk Model</h3><p>Personal thermal profile and dynamic risk curve.</p></article>
      </div>
    </section>
  );
}
