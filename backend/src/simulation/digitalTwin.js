import { randomUUID } from 'node:crypto';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export const SCENARIO_PROFILES = {
  balanced: {
    key: 'balanced',
    label: 'مباراة متوازنة',
    fatigueDrift: [1.5, 3.8],
    accelerationBoost: 0,
    temperatureBoost: 0,
    sleepPenalty: 0
  },
  intense: {
    key: 'intense',
    label: 'ضغط تنافسي عالٍ',
    fatigueDrift: [2.5, 5.2],
    accelerationBoost: 0.35,
    temperatureBoost: 0.28,
    sleepPenalty: 0.4
  },
  heatwave: {
    key: 'heatwave',
    label: 'أجواء حارة ورطبة',
    fatigueDrift: [2.1, 4.7],
    accelerationBoost: 0.15,
    temperatureBoost: 0.65,
    sleepPenalty: 0.2
  }
};

function resolveScenario(profileKey) {
  return SCENARIO_PROFILES[profileKey] || SCENARIO_PROFILES.balanced;
}

export function createDigitalTwinSimulation({
  getPlayerById,
  getPlayerTwinProfile,
  onMetric,
  onStart,
  onComplete
}) {
  const activeSessions = new Map();

  function start({
    playerId,
    durationTicks = 45,
    sleepHours = 6.6,
    scenario = 'balanced',
    notes = null
  }) {
    const player = getPlayerById(playerId);
    if (!player) {
      return { error: 'player not found' };
    }
    const twinProfile = getPlayerTwinProfile?.(player.id);

    const scenarioProfile = resolveScenario(scenario);
    const sessionId = randomUUID();
    const traits = {
      recoverySpeed: Number(twinProfile?.recovery_speed || 1),
      injurySensitivity: Number(twinProfile?.injury_sensitivity || 1),
      neuralFatigueFactor: Number(twinProfile?.neural_fatigue_factor || 1),
      heatFactor: Number(twinProfile?.heat_factor || 1)
    };

    const state = {
      id: sessionId,
      playerId: player.id,
      scenario: scenarioProfile.key,
      ticks: 0,
      maxTicks: Number(durationTicks),
      sleepHours:
        Number(sleepHours) -
        scenarioProfile.sleepPenalty -
        (traits.neuralFatigueFactor - 1) * 0.35,
      fatigueBase: random(22, 38),
      risks: [],
      traits
    };

    const dbSession = onStart({
      id: sessionId,
      playerId: player.id,
      scenario: scenarioProfile.key,
      notes
    });

    if (!dbSession) {
      return { error: 'failed to create simulation session' };
    }

    state.timer = setInterval(() => {
      state.ticks += 1;

      const recoveryBuffer = clamp((state.traits.recoverySpeed - 1) * 1.7, -0.7, 0.8);
      const neuralPressure = clamp((state.traits.neuralFatigueFactor - 1) * 1.5, -0.4, 0.8);
      const injuryPressure = clamp((state.traits.injurySensitivity - 1) * 1.3, -0.4, 0.8);
      const driftMin = Math.max(
        0.7,
        scenarioProfile.fatigueDrift[0] + injuryPressure + neuralPressure - recoveryBuffer
      );
      const driftMax = Math.max(
        driftMin + 0.35,
        scenarioProfile.fatigueDrift[1] + injuryPressure + neuralPressure - recoveryBuffer + 0.3
      );

      state.fatigueBase = clamp(
        state.fatigueBase + random(driftMin, driftMax),
        15,
        99
      );

      const heartRate = clamp(
        player.resting_hr + state.fatigueBase * 1.28 + random(-5, 8),
        50,
        player.max_hr + 10
      );
      const acceleration = clamp(
        1.0 +
          state.fatigueBase * 0.033 +
          random(-0.16, 0.24) +
          scenarioProfile.accelerationBoost +
          (state.traits.neuralFatigueFactor - 1) * 0.22,
        0.4,
        6.2
      );
      const temperature = clamp(
        36.4 +
          state.fatigueBase * 0.026 +
          random(-0.12, 0.2) +
          scenarioProfile.temperatureBoost +
          (state.traits.heatFactor - 1) * 0.55,
        35.9,
        41.2
      );

      const metric = onMetric({
        playerId: player.id,
        sessionId,
        source: `simulation:${scenarioProfile.key}`,
        input: {
          heartRate: Number(heartRate.toFixed(1)),
          acceleration: Number(acceleration.toFixed(2)),
          temperature: Number(temperature.toFixed(1)),
          sleepHours: Number(clamp(state.sleepHours, 3.0, 9.5).toFixed(1))
        }
      });

      if (metric?.overallRisk !== undefined) {
        state.risks.push(Number(metric.overallRisk));
      }

      if (state.ticks >= state.maxTicks) {
        stop(sessionId, 'completed');
      }
    }, 2000);

    activeSessions.set(sessionId, state);

    return {
      id: sessionId,
      playerId: player.id,
      scenario: scenarioProfile.key,
      scenarioLabel: scenarioProfile.label,
      status: 'running',
      ticks: 0,
      maxTicks: state.maxTicks,
      sleepHours: Number(clamp(state.sleepHours, 3.0, 9.5).toFixed(1)),
      traits,
      notes
    };
  }

  function stop(sessionId, reason = 'stopped') {
    const state = activeSessions.get(sessionId);
    if (!state) {
      return null;
    }

    clearInterval(state.timer);
    activeSessions.delete(sessionId);

    const avgRisk =
      state.risks.length === 0
        ? 0
        : state.risks.reduce((sum, item) => sum + item, 0) / state.risks.length;

    return onComplete({
      id: sessionId,
      status: reason,
      ticks: state.ticks,
      avgOverallRisk: Number(avgRisk.toFixed(1)),
      finalFatigue: Number(state.fatigueBase.toFixed(1))
    });
  }

  function listActive() {
    return [...activeSessions.values()].map((state) => ({
      id: state.id,
      playerId: state.playerId,
      scenario: state.scenario,
      ticks: state.ticks,
      maxTicks: state.maxTicks,
      sleepHours: Number(clamp(state.sleepHours, 3.0, 9.5).toFixed(1))
    }));
  }

  return { start, stop, listActive };
}
