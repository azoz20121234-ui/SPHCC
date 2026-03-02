function tone(value) {
  if (value >= 80) return 'critical';
  if (value >= 65) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

export default function SeasonInjuryMap({ games }) {
  return (
    <div className="season-injury-map" role="img" aria-label="خريطة احتمالية الإصابة الموسمية">
      {(games || []).map((item) => (
        <div
          key={item.match}
          className={`injury-cell ${tone(Number(item.injuryProbability || 0))}`}
          title={`مباراة ${item.match}: ${item.injuryProbability}%`}
        >
          <span>{item.match}</span>
          <strong>{item.injuryProbability}%</strong>
        </div>
      ))}
    </div>
  );
}
