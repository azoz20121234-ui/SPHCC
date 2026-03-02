import { randomUUID } from 'node:crypto';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export function createDigitalTwinSimulation({ getPlayerById, onMetric, onStart, onComplete }) {
  const activeSessions = new Map();

  function start({ playerId, durationTicks = 45, sleepHours = 6.6, notes = null }) {
    const player = getPlayerById(playerId);
    if (!player) {
      return { error: 'player not found' };
    }

    const sessionId = randomUUID();
    const state = {
      id: sessionId,
      playerId: player.id,
      ticks: 0,
      maxTicks: Number(durationTicks),
      sleepHours: Number(sleepHours),
      fatigueBase: random(22, 38),
      risks: []
    };

    const dbSession = onStart({ id: sessionId, playerId: player.id, notes });
    if (!dbSession) {
      return { error: 'failed to create simulation session' };
    }

    state.timer = setInterval(() => {
      state.ticks += 1;
      state.fatigueBase = clamp(state.fatigueBase + random(1.6, 4.8), 15, 99);

      const heartRate = clamp(player.resting_hr + state.fatigueBase * 1.28 + random(-5, 8), 50, player.max_hr + 10);
      const acceleration = clamp(1.0 + state.fatigueBase * 0.033 + random(-0.16, 0.24), 0.4, 5.9);
      const temperature = clamp(36.4 + state.fatigueBase * 0.026 + random(-0.12, 0.2), 35.9, 40.6);

      const metric = onMetric({
        playerId: player.id,
        sessionId,
        source: 'simulation',
        input: {
          heartRate: Number(heartRate.toFixed(1)),
          acceleration: Number(acceleration.toFixed(2)),
          temperature: Number(temperature.toFixed(1)),
          sleepHours: state.sleepHours
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
      status: 'running',
      ticks: 0,
      maxTicks: state.maxTicks,
      sleepHours: state.sleepHours,
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
      ticks: state.ticks,
      maxTicks: state.maxTicks,
      sleepHours: state.sleepHours
    }));
  }

  return { start, stop, listActive };
}
