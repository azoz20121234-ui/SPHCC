function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function startTelemetry(callback, options = {}) {
  const playerId = Number(options.playerId || 1);
  const tickMs = Number(options.tickMs || 1000);

  const state = {
    fatigue: clamp(36 + playerId * 2, 0, 100),
    neuralLoad: clamp(31 + playerId * 1.7, 0, 100),
    heatStress: clamp(26 + playerId * 1.4, 0, 100),
    hydration: clamp(84 - playerId * 1.5, 0, 100),
    heartRate: 120
  };

  let t = 0;

  const timer = setInterval(() => {
    t += 1;

    state.fatigue = clamp(state.fatigue + 0.4 + Math.sin(t / 5) * 0.2, 0, 100);
    state.neuralLoad = clamp(state.neuralLoad + 0.3 + Math.cos(t / 7) * 0.2, 0, 100);
    state.heatStress = clamp(state.heatStress + 0.2 + Math.sin(t / 9) * 0.05, 0, 100);
    state.hydration = clamp(state.hydration - 0.15 - Math.cos(t / 11) * 0.02, 0, 100);
    state.heartRate = clamp(110 + state.fatigue * 0.5 + state.neuralLoad * 0.08, 55, 215);

    callback({
      ...state,
      tick: t,
      timestamp: new Date().toISOString()
    });
  }, tickMs);

  return () => clearInterval(timer);
}
