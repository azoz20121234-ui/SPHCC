function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function buildProjection(metric) {
  const risk = Number(metric?.overallRisk || 0);
  const ratePerSecond = Math.max(0.05, Number(metric?.escalationRate || 0.1));
  const ratePerMinute = ratePerSecond * 60;

  return Array.from({ length: 11 }).map((_, minute) => ({
    minute,
    risk: Number(clamp(risk + minute * ratePerMinute, 0, 100).toFixed(1))
  }));
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) return '∞';
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function TimelineProjection({ selectedMetric }) {
  if (!selectedMetric) {
    return (
      <section className="panel timeline-panel">
        <h2>Risk Timeline Projection</h2>
        <p className="muted">اختر لاعبًا لعرض التوقع الزمني.</p>
      </section>
    );
  }

  const width = 620;
  const height = 190;
  const paddingX = 26;
  const paddingY = 24;
  const series = buildProjection(selectedMetric);
  const threshold = 75;

  const points = series.map((item) => {
    const x = paddingX + (item.minute / 10) * (width - paddingX * 2);
    const y = height - paddingY - (item.risk / 100) * (height - paddingY * 2);
    return { ...item, x, y };
  });

  const path = points
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const turningPoint = points.find((point) => point.risk >= threshold) || null;

  return (
    <section className="panel timeline-panel">
      <div className="timeline-header">
        <h2>Risk Timeline Projection</h2>
        <span>Safe Time Remaining: {formatSeconds(selectedMetric?.countdownToThreshold)}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Risk projection timeline">
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className="axis-line" />
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="axis-line"
        />
        <line
          x1={paddingX}
          y1={height - paddingY - (threshold / 100) * (height - paddingY * 2)}
          x2={width - paddingX}
          y2={height - paddingY - (threshold / 100) * (height - paddingY * 2)}
          className="threshold-line"
        />
        <path d={path} className="timeline-path" />
        {turningPoint && <circle cx={turningPoint.x} cy={turningPoint.y} r="5" className="turning-point" />}
      </svg>
    </section>
  );
}
