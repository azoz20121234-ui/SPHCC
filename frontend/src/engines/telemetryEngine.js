const DEFAULT_TICK_MS = 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function seedFromPlayer(player) {
  const idPart = Number(player?.id || 1) * 0.37;
  const namePart = String(player?.name || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return idPart + namePart * 0.0019;
}

function profileFromPlayer(player) {
  const sport = String(player?.sport || '').toLowerCase();
  const restingHr = Number(player?.resting_hr || player?.restingHr || 58);
  const maxHr = Number(player?.max_hr || player?.maxHr || 195);

  if (sport.includes('basketball')) {
    return { restingHr, maxHr, accelerationBase: 1.2, heatSensitivity: 1.03, recovery: 0.94 };
  }
  if (sport.includes('football')) {
    return { restingHr, maxHr, accelerationBase: 1.05, heatSensitivity: 1.07, recovery: 0.91 };
  }

  return { restingHr, maxHr, accelerationBase: 1, heatSensitivity: 1, recovery: 0.9 };
}

function initPlayerState(player) {
  const seed = seedFromPlayer(player);
  const profile = profileFromPlayer(player);
  const fatigue = clamp(24 + Math.sin(seed * 2.4) * 8 + Math.cos(seed * 0.7) * 3, 12, 42);
  const neuralLoad = clamp(20 + Math.sin(seed * 1.8) * 7, 10, 38);
  const hydration = clamp(28 + Math.cos(seed * 1.3) * 6, 12, 40);
  const sleepHours = clamp(6.7 + Math.sin(seed * 1.1) * 0.8, 5.2, 8.4);

  return {
    playerId: Number(player.id),
    seed,
    profile,
    fatigue,
    neuralLoad,
    hydration,
    sleepHours
  };
}

function generateTelemetrySample(state, tick) {
  const t = Number(tick);
  const macroWave = Math.sin(t * 0.055 + state.seed * 1.7);
  const paceWave = Math.cos(t * 0.19 + state.seed * 0.9);
  const thermalWave = Math.sin(t * 0.08 + state.seed * 2.1);
  const circadianWave = Math.cos(t * 0.01 + state.seed * 0.6);

  const fatigueDrift = 0.54 + macroWave * 0.42 + paceWave * 0.21;
  const neuralDrift = 0.45 + paceWave * 0.35 + macroWave * 0.18;
  const hydrationDrift = 0.24 + thermalWave * 0.2 - circadianWave * 0.11;

  state.fatigue = clamp(state.fatigue + fatigueDrift - state.profile.recovery * 0.2, 10, 98);
  state.neuralLoad = clamp(state.neuralLoad + neuralDrift - state.profile.recovery * 0.17, 8, 98);
  state.hydration = clamp(state.hydration + hydrationDrift, 8, 98);
  state.sleepHours = clamp(6.5 + circadianWave * 1.05, 4.5, 8.8);

  const acceleration = clamp(
    state.profile.accelerationBase + state.fatigue * 0.028 + state.neuralLoad * 0.012 + paceWave * 0.16,
    0.4,
    6.4
  );
  const temperature = clamp(
    36.4 + state.fatigue * 0.024 + state.hydration * 0.01 + thermalWave * 0.14 * state.profile.heatSensitivity,
    35.9,
    41.2
  );
  const heartRate = clamp(
    state.profile.restingHr +
      state.fatigue * 1.2 +
      acceleration * 4.2 +
      (temperature - 36.5) * 6.2 +
      state.neuralLoad * 0.12,
    48,
    state.profile.maxHr + 12
  );

  return {
    playerId: state.playerId,
    heartRate: round(heartRate, 1),
    acceleration: round(acceleration, 2),
    temperature: round(temperature, 1),
    sleepHours: round(state.sleepHours, 1),
    telemetry: {
      fatigueSignal: round(state.fatigue, 1),
      neuralSignal: round(state.neuralLoad, 1),
      hydrationSignal: round(state.hydration, 1)
    }
  };
}

export function createTelemetryEngine({ players = [], onTick, tickMs = DEFAULT_TICK_MS } = {}) {
  const states = new Map();
  let timer = null;
  let tick = 0;

  function setPlayers(nextPlayers = []) {
    const playerIds = new Set(nextPlayers.map((p) => Number(p.id)));

    nextPlayers.forEach((player) => {
      const id = Number(player.id);
      if (!states.has(id)) {
        states.set(id, initPlayerState(player));
      }
    });

    [...states.keys()].forEach((id) => {
      if (!playerIds.has(id)) {
        states.delete(id);
      }
    });
  }

  function step() {
    tick += 1;
    const samples = [...states.values()].map((state) => generateTelemetrySample(state, tick));
    const payload = {
      tick,
      timestamp: new Date().toISOString(),
      samples
    };

    if (typeof onTick === 'function') {
      onTick(payload);
    }

    return payload;
  }

  function start() {
    if (timer) return;
    timer = setInterval(step, Number(tickMs));
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  function reset(nextTick = 0) {
    tick = Number(nextTick);
  }

  setPlayers(players);

  return {
    start,
    stop,
    step,
    reset,
    setPlayers,
    isRunning: () => Boolean(timer)
  };
}
