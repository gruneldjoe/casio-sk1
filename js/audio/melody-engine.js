/**
 * @file Melody sequencer & arpeggiator — tempo-synced via rhythm engine master clock.
 */
import { getContext } from './engine.js';
import { getMasterTempo, getStepDuration } from './rhythm-engine.js';
import { playMelodyNote, stopAllVoices } from './melody-voice.js';
import { getPitch, PITCHES, DEFAULT_ROOT_INDEX } from './notes.js';
import { buildArpOrder, getScalePitchIndices } from './scales.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const STEPS_PER_BAR = 16;
const MAX_NOTES_PER_STEP = 4;

/** @typedef {'sequencer' | 'arpeggiator'} MelodyMode */
/** @typedef {'16th' | '8th' | '4th'} ArpRate */
/** @typedef {(step: number) => void} MelodyStepCallback */

/** @type {number | null} */
let schedulerTimer = null;

let isPlaying = false;
let mode = 'sequencer';
let currentStep = 0;

let nextTickIndex = 0;
let nextTickTime = 0;

/** @type {number[][]} 16 steps, each holds up to 4 pitch indices */
const sequence = Array.from({ length: STEPS_PER_BAR }, () => []);

let rootIndex = DEFAULT_ROOT_INDEX;
/** @type {import('./scales.js').ScaleName} */
let scaleName = 'major';
/** @type {import('./scales.js').ArpDirection} */
let arpDirection = 'up';
/** @type {ArpRate} */
let arpRate = '16th';

let arpOrder = [];
let arpOrderIndex = 0;

/** @type {MelodyStepCallback | null} */
let onStepChange = null;

/**
 * @param {ArpRate} rate
 * @returns {number} seconds per arp tick
 */
function arpTickDuration(rate) {
  const step = getStepDuration();
  switch (rate) {
    case '8th': return step * 2;
    case '4th': return step * 4;
    default: return step;
  }
}

function ticksPerBar() {
  if (mode === 'sequencer') return STEPS_PER_BAR;
  const step = getStepDuration();
  const tick = arpTickDuration(arpRate);
  return Math.max(1, Math.round((step * STEPS_PER_BAR) / tick));
}

function rebuildArpOrder() {
  const indices = getScalePitchIndices(rootIndex, scaleName);
  arpOrder = buildArpOrder(indices, arpDirection);
  arpOrderIndex = 0;
}

function scheduleSequencerStep(step, time) {
  const notes = sequence[step] ?? [];
  const gate = getStepDuration() * 0.88;
  const toPlay = notes.slice(0, MAX_NOTES_PER_STEP);

  toPlay.forEach((pitchIndex, i) => {
    const pitch = getPitch(pitchIndex);
    if (!pitch) return;
    const offset = i * 0.002;
    playMelodyNote(pitch.freq, time + offset, gate);
  });
}

function scheduleArpTick(tick, time) {
  if (arpOrder.length === 0) rebuildArpOrder();

  const pitchIndex = arpOrder[arpOrderIndex % arpOrder.length];
  arpOrderIndex += 1;

  const pitch = getPitch(pitchIndex);
  if (!pitch) return;

  const gate = arpTickDuration(arpRate) * 0.85;
  playMelodyNote(pitch.freq, time, gate);
}

function schedulerTick() {
  const ctx = getContext();
  if (!ctx || !isPlaying) return;

  const totalTicks = ticksPerBar();

  while (nextTickTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
    if (mode === 'sequencer') {
      scheduleSequencerStep(nextTickIndex, nextTickTime);
    } else {
      scheduleArpTick(nextTickIndex, nextTickTime);
    }

    const uiStep = mode === 'sequencer'
      ? nextTickIndex
      : Math.floor((nextTickIndex * STEPS_PER_BAR) / totalTicks);

    const fireTime = nextTickTime;
    const delayMs = Math.max(0, (fireTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!isPlaying) return;
      currentStep = uiStep;
      onStepChange?.(uiStep);
    }, delayMs);

    nextTickIndex += 1;
    if (nextTickIndex >= totalTicks) {
      nextTickIndex = 0;
      if (arpDirection === 'random') rebuildArpOrder();
    }

    const delta = mode === 'sequencer'
      ? getStepDuration()
      : arpTickDuration(arpRate);
    nextTickTime += delta;
  }

  schedulerTimer = window.setTimeout(schedulerTick, LOOKAHEAD_MS);
}

/**
 * @param {MelodyStepCallback} cb
 */
export function setMelodyStepCallback(cb) {
  onStepChange = cb;
}

/** @returns {boolean} */
export function getMelodyIsPlaying() {
  return isPlaying;
}

/** @returns {MelodyMode} */
export function getMelodyMode() {
  return mode;
}

/** @returns {number} */
export function getMelodyStep() {
  return currentStep;
}

/** @returns {number[][]} */
export function getSequence() {
  return sequence.map((step) => [...step]);
}

export function startMelody() {
  const ctx = getContext();
  if (!ctx || isPlaying) return;

  rebuildArpOrder();
  isPlaying = true;
  currentStep = 0;
  nextTickIndex = 0;
  nextTickTime = ctx.currentTime + 0.05;
  schedulerTick();
}

export function stopMelody() {
  isPlaying = false;
  currentStep = 0;

  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  onStepChange?.(-1);
}

export function disposeMelody() {
  stopMelody();
  stopAllVoices();
}

/**
 * @param {MelodyMode} nextMode
 */
export function setMelodyMode(nextMode) {
  const wasPlaying = isPlaying;
  if (wasPlaying) stopMelody();
  mode = nextMode;
  rebuildArpOrder();
}

/**
 * @param {number} step 0–15
 * @param {number} pitchIndex
 * @returns {boolean} whether toggle succeeded
 */
export function toggleSequenceCell(step, pitchIndex) {
  if (step < 0 || step >= STEPS_PER_BAR) return false;
  if (pitchIndex < 0 || pitchIndex >= PITCHES.length) return false;

  const cell = sequence[step];
  const idx = cell.indexOf(pitchIndex);

  if (idx >= 0) {
    cell.splice(idx, 1);
    return true;
  }

  if (cell.length >= MAX_NOTES_PER_STEP) return false;
  cell.push(pitchIndex);
  cell.sort((a, b) => a - b);
  return true;
}

/** @param {number} pitchIndex */
export function previewPitch(pitchIndex) {
  const pitch = getPitch(pitchIndex);
  if (!pitch) return;
  const ctx = getContext();
  if (!ctx) return;
  playMelodyNote(pitch.freq, ctx.currentTime, 0.15);
}

export function clearSequence() {
  sequence.forEach((step) => { step.length = 0; });
}

/** @param {number} index */
export function setRootIndex(index) {
  rootIndex = Math.max(0, Math.min(PITCHES.length - 1, index));
  rebuildArpOrder();
}

/** @returns {number} */
export function getRootIndex() {
  return rootIndex;
}

/**
 * @param {import('./scales.js').ScaleName} name
 */
export function setScale(name) {
  scaleName = name;
  rebuildArpOrder();
}

/**
 * @param {import('./scales.js').ArpDirection} dir
 */
export function setArpDirection(dir) {
  arpDirection = dir;
  rebuildArpOrder();
}

/**
 * @param {ArpRate} rate
 */
export function setArpRate(rate) {
  arpRate = rate;
}

/** @returns {import('./scales.js').ScaleName} */
export function getScaleName() {
  return scaleName;
}

/** @returns {import('./scales.js').ArpDirection} */
export function getArpDirection() {
  return arpDirection;
}

/** @returns {ArpRate} */
export function getArpRate() {
  return arpRate;
}

export function getMelodyTempo() {
  return getMasterTempo();
}

export { STEPS_PER_BAR, MAX_NOTES_PER_STEP, PITCHES };
