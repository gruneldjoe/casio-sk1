/**
 * @file Hybrid drum driver — procedural synthesis (default) with sample override hook.
 */
import { DRUM_MODE } from './config.js';
import { getContext, getDryBus, now } from './engine.js';
import { DRUM_VOICES } from './drum-patterns.js';

/** @typedef {typeof DRUM_VOICES[keyof typeof DRUM_VOICES]} DrumType */

/**
 * Future sample buffer map — populate when DRUM_MODE === 'SAMPLE'.
 * @type {Partial<Record<DrumType, AudioBuffer>>}
 */
export const audioBuffers = {};

/** UI labels for drum test pads */
export const DRUM_LABELS = {
  [DRUM_VOICES.bass]: 'Kick',
  [DRUM_VOICES.snare]: 'Snare',
  [DRUM_VOICES.hatClosed]: 'CH',
  [DRUM_VOICES.hatOpen]: 'OH',
  [DRUM_VOICES.rim]: 'Rim',
  [DRUM_VOICES.clap]: 'Clap',
  [DRUM_VOICES.cymbal]: 'Cym',
};

/**
 * Coordinator — all rhythm triggers flow through here.
 * @param {DrumType} drumType
 * @param {number} [time] AudioContext time; defaults to now()
 */
export function triggerDrumSound(drumType, time = now()) {
  const ctx = getContext();
  const bus = getDryBus();
  if (!ctx || !bus) return;

  if (DRUM_MODE === 'SYNTH') {
    synthDrum(ctx, bus, drumType, time);
    return;
  }

  if (DRUM_MODE === 'SAMPLE') {
    // --- Future: swap to external .wav buffers (single-flag migration) ---
    // const buffer = audioBuffers[drumType];
    // if (!buffer) return;
    // const source = ctx.createBufferSource();
    // source.buffer = buffer;
    // source.connect(bus);
    // source.start(time);
    // return;
    console.warn('[drums] SAMPLE mode selected but buffers not loaded');
  }
}

/**
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {DrumType} drumType
 * @param {number} time
 */
function synthDrum(ctx, destination, drumType, time) {
  switch (drumType) {
    case DRUM_VOICES.bass:
      synthKick(ctx, destination, time);
      break;
    case DRUM_VOICES.snare:
      synthSnare(ctx, destination, time);
      break;
    case DRUM_VOICES.hatClosed:
      synthHat(ctx, destination, time, 0.04, 6000);
      break;
    case DRUM_VOICES.hatOpen:
      synthHat(ctx, destination, time, 0.12, 4500);
      break;
    case DRUM_VOICES.rim:
      synthRim(ctx, destination, time);
      break;
    case DRUM_VOICES.clap:
      synthClap(ctx, destination, time);
      break;
    case DRUM_VOICES.cymbal:
      synthCymbal(ctx, destination, time);
      break;
    default:
      break;
  }
}

/** Pitch-sweep sine — classic SK-style digital kick thump */
function synthKick(ctx, destination, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);

  gain.gain.setValueAtTime(0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + 0.15);
}

/** Band-limited noise burst — thin metallic snare */
function synthSnare(ctx, destination, time) {
  const duration = 0.1;
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 1800;
  bpf.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.55, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  source.connect(bpf);
  bpf.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + duration);
}

/**
 * High-pass noise blip — closed/open hat
 * @param {number} decay
 * @param {number} hpFreq
 */
function synthHat(ctx, destination, time, decay, hpFreq) {
  const duration = decay;
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = hpFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  source.connect(hpf);
  hpf.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + duration);
}

/** Short sine ping — rim shot blip */
function synthRim(ctx, destination, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, time);
  osc.frequency.exponentialRampToValueAtTime(400, time + 0.02);

  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

/** Layered noise bursts — lo-fi clap */
function synthClap(ctx, destination, time) {
  [0, 0.012, 0.024].forEach((offset) => {
    const t = time + offset;
    const duration = 0.06;
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(hpf);
    hpf.connect(gain);
    gain.connect(destination);
    source.start(t);
    source.stop(t + duration);
  });
}

/** Long decay noise — crash cymbal shimmer */
function synthCymbal(ctx, destination, time) {
  const duration = 0.35;
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 5000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  source.connect(hpf);
  hpf.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + duration);
}
