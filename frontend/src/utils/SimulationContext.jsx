import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { startTelemetry } from '../engine/telemetryEngine.js';
import { calculateRiskSnapshot } from '../engine/riskEngine.js';
import {
  buildFinancialExposureFromRisk,
  buildMatchImpactFromRisk,
  calculateImpact
} from '../engine/impactEngine.js';
import { generateAiDecision } from '../engine/aiEngine.js';

const SimulationContext = createContext(null);

const PLAYERS = [
  {
    id: 1,
    name: 'خالد ناصر',
    sport: 'كرة القدم',
    position: 'وسط',
    twin: {
      baselineHealth: 84,
      recoveryRate: 1.08,
      neuralSensitivity: 0.96,
      heatTolerance: 0.89
    }
  },
  {
    id: 2,
    name: 'فهد سالم',
    sport: 'كرة السلة',
    position: 'صانع لعب',
    twin: {
      baselineHealth: 81,
      recoveryRate: 1.03,
      neuralSensitivity: 1.02,
      heatTolerance: 0.93
    }
  },
  {
    id: 3,
    name: 'سامي العتيبي',
    sport: 'كرة القدم',
    position: 'جناح',
    twin: {
      baselineHealth: 79,
      recoveryRate: 0.97,
      neuralSensitivity: 1.07,
      heatTolerance: 0.87
    }
  }
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function toMetric(player, sample, riskSnapshot) {
  const overallRisk = Number(riskSnapshot.risk);
  const hydrationRisk = round(clamp(100 - Number(sample.hydration || 0)));
  const injuryRisk = round(clamp(overallRisk * 0.78 + Number(sample.neuralLoad || 0) * 0.22));

  return {
    playerId: player.id,
    playerName: player.name,
    sport: player.sport,
    position: player.position,
    fatigueScore: round(sample.fatigue),
    neuralLoad: round(sample.neuralLoad),
    heatStress: round(sample.heatStress),
    hydration: round(sample.hydration),
    hydrationRisk,
    injuryRisk,
    overallRisk,
    escalationRate: Number(riskSnapshot.escalationRate),
    countdownToThreshold: Number(riskSnapshot.countdownToThreshold),
    heartRate: round(sample.heartRate),
    timestamp: sample.timestamp
  };
}

export function SimulationProvider({ children }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(PLAYERS[0].id);
  const [metricsByPlayer, setMetricsByPlayer] = useState({});
  const [historyByPlayer, setHistoryByPlayer] = useState({});
  const fatigueHistoryRef = useRef({});

  useEffect(() => {
    const stoppers = PLAYERS.map((player) =>
      startTelemetry((sample) => {
        const prevFatigue = fatigueHistoryRef.current[player.id] || [];
        const nextFatigue = [...prevFatigue, Number(sample.fatigue)].slice(-5);
        fatigueHistoryRef.current[player.id] = nextFatigue;

        const riskSnapshot = calculateRiskSnapshot(sample, nextFatigue, 75);
        const metric = toMetric(player, sample, riskSnapshot);
        const matchImpact = buildMatchImpactFromRisk(metric.overallRisk);
        const impact = calculateImpact(metric.overallRisk);
        const aiDecision = generateAiDecision(metric, matchImpact);
        const financialExposure = buildFinancialExposureFromRisk(metric.overallRisk).exposure;

        const snapshot = {
          ...metric,
          impact,
          matchImpact,
          aiDecision,
          financialExposure
        };

        setMetricsByPlayer((prev) => ({
          ...prev,
          [player.id]: snapshot
        }));

        setHistoryByPlayer((prev) => {
          const playerHistory = [snapshot, ...(prev[player.id] || [])].slice(0, 240);
          return {
            ...prev,
            [player.id]: playerHistory
          };
        });
      }, { playerId: player.id })
    );

    return () => {
      stoppers.forEach((stop) => stop());
    };
  }, []);

  const selectedPlayer = useMemo(
    () => PLAYERS.find((player) => player.id === selectedPlayerId) || PLAYERS[0],
    [selectedPlayerId]
  );
  const selectedMetric = metricsByPlayer[selectedPlayer.id] || null;
  const selectedHistory = historyByPlayer[selectedPlayer.id] || [];

  const teamMetrics = useMemo(
    () => PLAYERS.map((player) => metricsByPlayer[player.id]).filter(Boolean),
    [metricsByPlayer]
  );

  const teamReadiness = useMemo(() => {
    if (teamMetrics.length === 0) return 0;
    const values = teamMetrics.map((item) => clamp(100 - item.overallRisk * 0.85));
    return round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [teamMetrics]);

  const activeAlerts = useMemo(
    () => teamMetrics.filter((item) => Number(item.overallRisk) >= 75).length,
    [teamMetrics]
  );

  const value = useMemo(
    () => ({
      players: PLAYERS,
      selectedPlayerId,
      setSelectedPlayerId,
      selectedPlayer,
      selectedMetric,
      selectedHistory,
      metricsByPlayer,
      historyByPlayer,
      teamMetrics,
      teamReadiness,
      activeAlerts
    }),
    [
      activeAlerts,
      historyByPlayer,
      metricsByPlayer,
      selectedHistory,
      selectedMetric,
      selectedPlayer,
      selectedPlayerId,
      teamMetrics,
      teamReadiness
    ]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('يجب استخدام useSimulation داخل SimulationProvider');
  }
  return context;
}
