/**
 * @file 4-voice melody synthesizer — placeholder piano timbre until preset tones ship.
 */
import { MAX_POLYPHONY } from './config.js';
import { getContext, getDryBus, now } from './engine.js';

/** @typedef {{ osc: OscillatorNode, gain: GainNode, startedAt: number }} Voice */

/** @type {Voice[]} */
const pool = [];

/**
 * @param {number} freq Hz
 * @param {number} time AudioContext time
 * @param {number} duration seconds
 */
export function playMelodyNote(freq, time, duration) {
  const ctx = getContext();
  const bus = getDryBus();
  if (!ctx || !bus || freq <= 0) return;

  const voice = acquireVoice(ctx, time);
  const { osc, gain } = voice;

  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, time);

  const attack = 0.004;
  const release = Math.min(0.08, duration * 0.35);
  const sustainEnd = time + Math.max(0.01, duration - release);

  gain.gain.cancelScheduledValues(time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.22, time + attack);
  gain.gain.setValueAtTime(0.22, sustainEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.start(time);
  osc.stop(time + duration + 0.02);

  voice.startedAt = time;
}

/**
 * @param {AudioContext} ctx
 * @param {number} time
 * @returns {Voice}
 */
function acquireVoice(ctx, time) {
  if (pool.length < MAX_POLYPHONY) {
    const gain = ctx.createGain();
    gain.connect(getDryBus());
    const voice = { osc: null, gain, startedAt: time };
    pool.push(voice);
    return startVoice(ctx, voice, time);
  }

  let oldest = pool[0];
  for (const v of pool) {
    if (v.startedAt < oldest.startedAt) oldest = v;
  }
  try {
    oldest.osc?.stop(time);
  } catch {
    /* already stopped */
  }
  return startVoice(ctx, oldest, time);
}

/**
 * @param {AudioContext} ctx
 * @param {Voice} voice
 * @param {number} time
 * @returns {Voice}
 */
function startVoice(ctx, voice, time) {
  if (voice.osc) {
    try {
      voice.osc.disconnect();
    } catch {
      /* noop */
    }
  }
  voice.osc = ctx.createOscillator();
  voice.osc.connect(voice.gain);
  voice.startedAt = time;
  return voice;
}

/** Release all voices immediately (power off). */
export function stopAllVoices() {
  const t = now();
  for (const voice of pool) {
    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(0.0001, t);
      voice.osc?.stop(t + 0.01);
    } catch {
      /* noop */
    }
  }
}
