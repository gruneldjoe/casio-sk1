/**
 * @file Core Web Audio initialization and 8-bit signal chain
 */
import { MASTER_GAIN, SK1_SAMPLE_RATE } from './config.js';

const BIT_DEPTH = 8;

/** @type {AudioContext | null} */
let audioContext = null;

/** @type {GainNode | null} */
let masterGain = null;

/** @type {GainNode | null} */
let dryBus = null;

/** @type {AudioWorkletNode | null} */
let lofiNode = null;

/** @type {boolean} */
let isPowered = false;

/**
 * Initialize (or resume) the audio engine after user gesture.
 * @returns {Promise<AudioContext>}
 */
export async function powerOn() {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_GAIN;

    dryBus = audioContext.createGain();
    dryBus.gain.value = 1;

    await audioContext.audioWorklet.addModule(
      new URL('./lofi-processor.js', import.meta.url)
    );

    lofiNode = new AudioWorkletNode(audioContext, 'lofi-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    dryBus.connect(lofiNode);
    lofiNode.connect(masterGain);
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  isPowered = true;
  return audioContext;
}

/** Suspend the audio context (power off). */
export async function powerOff() {
  if (audioContext && audioContext.state === 'running') {
    await audioContext.suspend();
  }
  isPowered = false;
}

/** @returns {boolean} */
export function getIsPowered() {
  return isPowered;
}

/** @returns {AudioContext | null} */
export function getContext() {
  return audioContext;
}

/** @returns {number} Current time in seconds, or 0 if off. */
export function now() {
  return audioContext?.currentTime ?? 0;
}

/**
 * Bus all instrument/drum voices should connect to (pre Lo-Fi crunch).
 * @returns {GainNode | null}
 */
export function getDryBus() {
  return dryBus;
}

/**
 * Toggle Lo-Fi processor bypass for A/B comparison.
 * @param {boolean} bypass
 */
export function setLofiBypass(bypass) {
  lofiNode?.port.postMessage({ type: 'setBypass', value: bypass });
}

/**
 * Diagnostic info for the UI status line.
 * @returns {string}
 */
export function getEngineInfo() {
  if (!audioContext) return 'Engine not initialized';
  return `${BIT_DEPTH}-bit · ${SK1_SAMPLE_RATE} Hz · ctx ${Math.round(audioContext.sampleRate)} Hz · ${audioContext.state}`;
}
