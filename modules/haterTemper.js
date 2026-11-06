const QUIET_ACTIVITIES = new Set(['reading', 'gaming', 'music', 'sleeping']);

export function createHaterTemper() {
  let pressure = 0;
  let lastNoise = null;
  let warningUntil = 0;
  let unspentNoiseUntil = 0;

  function coolDown(now) {
    if (lastNoise !== null && now - lastNoise >= 18_000) {
      pressure = Math.max(0, pressure - Math.floor((now - lastNoise) / 18_000));
      lastNoise += Math.floor((now - lastNoise) / 18_000) * 18_000;
    }
    if (!pressure) warningUntil = 0;
  }

  function hear(kind, activity, now = Date.now()) {
    coolDown(now);
    if (activity === 'smoking') return 'ignore';
    if (kind === 'apology') {
      if (warningUntil > now) {
        // Извинение она услышала. Границу всё равно придётся соблюдать.
        return 'gesture';
      }
      pressure = Math.max(0, pressure - 2);
      return 'reply';
    }
    if (kind === 'kind') {
      pressure = Math.max(0, pressure - 1);
      return pressure < 4 ? 'reply' : 'ignore';
    }

    const quiet = QUIET_ACTIVITIES.has(activity);
    const weight = kind === 'poke' || kind === 'hostile' || kind === 'loud' ? 2 : 1;
    pressure = Math.min(10, pressure + weight);
    lastNoise = now;
    if (!quiet && pressure >= 3) unspentNoiseUntil = now + 100_000;
    if (warningUntil > now && pressure >= (quiet ? 5 : 7)) {
      pressure = 2;
      warningUntil = 0;
      unspentNoiseUntil = 0;
      return 'retreat';
    }
    if (warningUntil <= now && pressure >= (quiet ? 2 : 5)) {
      warningUntil = now + 45_000;
      return 'warn';
    }
    return kind === 'poke' || kind === 'addressed' ? 'reply' : 'ignore';
  }

  function settleInto(activity, now = Date.now()) {
    coolDown(now);
    if (!['gaming', 'music'].includes(activity) || unspentNoiseUntil <= now) return false;
    unspentNoiseUntil = 0;
    pressure = Math.max(3, pressure);
    warningUntil = now + 45_000;
    return true;
  }

  return { hear, settleInto, hasUnspentNoise: (now = Date.now()) => unspentNoiseUntil > now };
}
