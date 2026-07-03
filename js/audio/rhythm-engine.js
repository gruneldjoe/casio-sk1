/**
 * @file Auto-Rhythm transport — lookahead scheduler decoupled from synthesis.
 */
import { getContext, now } from './engine.js';
import { triggerDrumSound } from './drums.js';
import {
  RHYTHM_PATTERNS,
  FILL_PATTERNS,
  DEFAULT_FILL,
  DRUM_VOICES,
  STEPS_PER_BAR,
} from './drum-patterns.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const TEMPO_MIN = 40;
const TEMPO_MAX = 240;
const TEMPO_STEP = 4;
const DEFAULT_TEMPO = 120;

/** @typedef {(step: number, isFill: boolean) => void} StepCallback */

/** @type {number | null} */
let schedulerTimer = null;

let isPlaying = false;
let tempo = DEFAULT_TEMPO;
let patternIndex = 0;

let currentStep = 0;
let nextStepIndex = 0;
let nextStepTime = 0;

let fillQueued = false;
let fillActive = false;

/** @type {StepCallback | null} */
let onStepChange = null;

/**
 * Duration of one 16th-note step in seconds.
 * 16 steps = 1 bar (4 beats in 4/4).
 */
function stepDuration() {
  return (60 / tempo) / 4;
}

/** @returns {import('./drum-patterns.js').RhythmPattern} */
function getPattern() {
  return RHYTHM_PATTERNS[patternIndex] ?? RHYTHM_PATTERNS[0];
}

/** @returns {Record<string, number[]>} */
function getActiveStepMatrix() {
  const name = getPattern().name;
  if (fillActive) {
    return FILL_PATTERNS[name] ?? DEFAULT_FILL;
  }
  return getPattern().steps;
}

/**
 * Schedule all drum hits for a single step.
 * @param {number} step
 * @param {number} time
 */
function scheduleStep(step, time) {
  const matrix = getActiveStepMatrix();
  for (const voice of Object.values(DRUM_VOICES)) {
    if (matrix[voice]?.[step]) {
      triggerDrumSound(voice, time);
    }
  }
}

function schedulerTick() {
  const ctx = getContext();
  if (!ctx || !isPlaying) return;

  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
    scheduleStep(nextStepIndex, nextStepTime);

    const uiStep = nextStepIndex;
    const uiFill = fillActive;
    const fireTime = nextStepTime;
    const delayMs = Math.max(0, (fireTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!isPlaying) return;
      currentStep = uiStep;
      onStepChange?.(uiStep, uiFill);
    }, delayMs);

    nextStepIndex += 1;

    if (nextStepIndex >= STEPS_PER_BAR) {
      nextStepIndex = 0;
      if (fillQueued) {
        fillActive = true;
        fillQueued = false;
      } else if (fillActive) {
        fillActive = false;
      }
    }

    nextStepTime += stepDuration();
  }

  schedulerTimer = window.setTimeout(schedulerTick, LOOKAHEAD_MS);
}

/**
 * @param {StepCallback} callback
 */
export function setStepCallback(callback) {
  onStepChange = callback;
}

/** @returns {boolean} */
export function getIsPlaying() {
  return isPlaying;
}

/** @returns {number} */
export function getTempo() {
  return tempo;
}

/** @returns {number} */
export function getPatternIndex() {
  return patternIndex;
}

/** @returns {number} */
export function getCurrentStep() {
  return currentStep;
}

/** @returns {boolean} */
export function getFillActive() {
  return fillActive;
}

/** @returns {boolean} */
export function getFillQueued() {
  return fillQueued;
}

export function start() {
  const ctx = getContext();
  if (!ctx || isPlaying) return;

  isPlaying = true;
  currentStep = 0;
  nextStepIndex = 0;
  nextStepTime = ctx.currentTime + 0.05;
  fillActive = false;
  fillQueued = false;
  schedulerTick();
}

export function stop() {
  isPlaying = false;
  fillActive = false;
  fillQueued = false;
  currentStep = 0;

  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  onStepChange?.(-1, false);
}

/**
 * @param {number} index
 */
export function setPattern(index) {
  patternIndex = Math.max(0, Math.min(RHYTHM_PATTERNS.length - 1, index));
}

/**
 * @param {number} bpm
 */
export function setTempo(bpm) {
  tempo = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, bpm));
}

export function nudgeTempo(delta) {
  setTempo(tempo + delta * TEMPO_STEP);
}

/**
 * Queue a one-bar fill at the next bar boundary.
 * If stopped, plays the fill once immediately.
 */
export function triggerFillIn() {
  const ctx = getContext();
  if (!ctx) return;

  if (isPlaying) {
    fillQueued = true;
    return;
  }

  playFillOnce();
}

/** Play a single fill bar without starting the main loop */
function playFillOnce() {
  const ctx = getContext();
  if (!ctx) return;

  const name = getPattern().name;
  const matrix = FILL_PATTERNS[name] ?? DEFAULT_FILL;
  const startTime = ctx.currentTime + 0.02;
  const dur = stepDuration();

  for (let step = 0; step < STEPS_PER_BAR; step++) {
    const time = startTime + step * dur;
    for (const voice of Object.values(DRUM_VOICES)) {
      if (matrix[voice]?.[step]) {
        triggerDrumSound(voice, time);
      }
    }
    const stepNum = step;
    setTimeout(() => {
      onStepChange?.(stepNum, true);
    }, (time - ctx.currentTime) * 1000);
  }

  setTimeout(() => {
    onStepChange?.(-1, false);
  }, (startTime + STEPS_PER_BAR * dur - ctx.currentTime) * 1000);
}

export function dispose() {
  stop();
}

/** Shared master tempo accessor for future arpeggiator sync */
export function getMasterTempo() {
  return tempo;
}

export function getStepDuration() {
  return stepDuration();
}

export { RHYTHM_PATTERNS, TEMPO_MIN, TEMPO_MAX, TEMPO_STEP };
