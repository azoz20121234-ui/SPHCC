function mapPoint(value, index, total, width, height, padding) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const x = padding + (index / Math.max(1, total - 1)) * usableWidth;
  const y = height - padding - (value / 100) * usableHeight;
  return { x, y };
}

export default function SeasonFatigueCurve({ games }) {
  const width = 680;
  const height = 220;
  const padding = 24;
  const points = (games || []).map((item, index) =>
    mapPoint(Number(item.fatigue || 0), index, games.length, width, height, padding)
  );
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const peakIndex = games.reduce(
    (acc, item, index) => (Number(item.fatigue || 0) > Number(games[acc]?.fatigue || 0) ? index : acc),
    0
  );
  const peakPoint = points[peakIndex];

  return (
    <div className="season-curve">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="منحنى إجهاد الموسم">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis-line" />
        <path d={path} className="season-curve-path" />
        {peakPoint ? <circle cx={peakPoint.x} cy={peakPoint.y} r="5" className="turning-point" /> : null}
      </svg>
      <p className="muted">
        نقطة الذروة عند مباراة {Number(games[peakIndex]?.match || 1)} بنسبة إجهاد {Number(games[peakIndex]?.fatigue || 0)}%
      </p>
    </div>
  );
}
