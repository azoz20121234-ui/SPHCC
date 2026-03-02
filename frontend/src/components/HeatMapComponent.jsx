import { useEffect, useMemo, useState } from 'react';
import { clamp, computeNeuralLoad } from '../utils/riskMath.js';

function colorForLoad(value) {
  if (value >= 82) return '#dc2626';
  if (value >= 68) return '#ea580c';
  if (value >= 54) return '#f59e0b';
  if (value >= 40) return '#22c55e';
  return '#16a34a';
}

const ROWS = 5;
const COLS = 8;

export default function HeatMapComponent({ selectedMetric, decisionData }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const fatigueScore = Number(selectedMetric?.fatigueScore || 0);
  const neuralLoad = computeNeuralLoad(selectedMetric, decisionData);
  const blendedLoad = clamp(fatigueScore * 0.57 + neuralLoad * 0.43);

  const cells = useMemo(() => {
    const next = [];

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const centerBias = 1 - Math.abs(col - (COLS - 1) / 2) / (COLS / 2);
        const laneBias = 1 - Math.abs(row - (ROWS - 1) / 2) / (ROWS / 2);
        const tacticalBias = (centerBias * 0.62 + laneBias * 0.38) * 16;
        const wave = Math.sin((row + 1) * 0.9 + (col + 1) * 0.65 + tick * 0.55) * 5;
        const load = clamp(blendedLoad + tacticalBias + wave, 8, 99);

        next.push({
          id: `${row}-${col}`,
          value: Number(load.toFixed(1)),
          color: colorForLoad(load)
        });
      }
    }

    return next;
  }, [blendedLoad, tick]);

  return (
    <section className="panel heatmap-panel">
      <div className="heatmap-header">
        <h2>خريطة إجهاد الملعب</h2>
        <p>
          تعتمد على الإجهاد ({fatigueScore.toFixed(1)}%) + الحمل العصبي ({neuralLoad.toFixed(1)}%)
        </p>
      </div>

      <div className="field-grid" aria-label="خريطة تكتيكية لإجهاد الملعب">
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="field-cell"
            style={{
              backgroundColor: cell.color,
              opacity: 0.18 + cell.value / 135
            }}
            title={`الحمل ${cell.value}%`}
          />
        ))}
      </div>

      <div className="heatmap-legend">
        <span className="chip low">منخفض</span>
        <span className="chip medium">متوسط</span>
        <span className="chip high">مرتفع</span>
        <span className="chip critical">حرج</span>
      </div>
    </section>
  );
}
