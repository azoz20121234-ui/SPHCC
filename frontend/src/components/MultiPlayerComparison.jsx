import { useMemo, useState } from 'react';
import { calculateImpact } from '../engine/impactEngine.js';

function rowFromMetric(player, metric) {
  const risk = Number(metric?.overallRisk || 0);
  const impact = calculateImpact(risk);
  return {
    playerId: player.id,
    playerName: player.name,
    fatigue: Number(metric?.fatigueScore || 0),
    injuryRisk: Number(metric?.injuryRisk || 0),
    winImpact: Number(impact.winDeltaIfStay || 0),
    financialExposure: Number(impact.financialExposure || 0),
    overallRisk: risk
  };
}

export default function MultiPlayerComparison({ players, latestMetricsMap, fmtNum }) {
  const [playerA, setPlayerA] = useState(String(players?.[0]?.id || '1'));
  const [playerB, setPlayerB] = useState(String(players?.[1]?.id || players?.[0]?.id || '1'));

  const rows = useMemo(() => {
    const a = players.find((player) => String(player.id) === String(playerA));
    const b = players.find((player) => String(player.id) === String(playerB));
    if (!a || !b) return [];
    return [
      rowFromMetric(a, latestMetricsMap.get(a.id)),
      rowFromMetric(b, latestMetricsMap.get(b.id))
    ];
  }, [latestMetricsMap, playerA, playerB, players]);

  const highRiskPlayerId =
    rows.length === 2 && rows[0].overallRisk !== rows[1].overallRisk
      ? (rows[0].overallRisk > rows[1].overallRisk ? rows[0].playerId : rows[1].playerId)
      : null;

  return (
    <section className="panel comparison-panel layout-full">
      <h2>مقارنة متعددة اللاعبين</h2>
      <div className="comparison-selectors">
        <select value={playerA} onChange={(event) => setPlayerA(event.target.value)}>
          {players.map((player) => (
            <option key={`a-${player.id}`} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <select value={playerB} onChange={(event) => setPlayerB(event.target.value)}>
          {players.map((player) => (
            <option key={`b-${player.id}`} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      <table className="comparison-table">
        <thead>
          <tr>
            <th>اللاعب</th>
            <th>الإجهاد</th>
            <th>مخاطر الإصابة</th>
            <th>تأثير الفوز</th>
            <th>التعرض المالي</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.playerId}
              className={highRiskPlayerId && highRiskPlayerId === row.playerId ? 'risk-highlight' : ''}
            >
              <td>{row.playerName}</td>
              <td>{fmtNum(row.fatigue)}%</td>
              <td>{fmtNum(row.injuryRisk)}%</td>
              <td>{fmtNum(row.winImpact)}%</td>
              <td>ر.س {Math.round(row.financialExposure).toLocaleString('ar-SA')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
