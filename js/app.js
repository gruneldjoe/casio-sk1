/**
 * @file UI wiring — Power, Auto-Rhythm, Melody Sequencer / Arpeggiator
 */
import {
  powerOn,
  powerOff,
  getIsPowered,
  getEngineInfo,
  setLofiBypass,
} from './audio/engine.js';
import { triggerDrumSound, DRUM_LABELS } from './audio/drums.js';
import {
  RHYTHM_PATTERNS,
  FILL_PATTERNS,
  DEFAULT_FILL,
  compositeSteps,
  DRUM_VOICES,
} from './audio/drum-patterns.js';
import {
  start as startRhythm,
  stop as stopRhythm,
  getIsPlaying,
  getTempo,
  getPatternIndex,
  setPattern,
  nudgeTempo,
  triggerFillIn,
  setStepCallback,
  dispose as disposeRhythm,
} from './audio/rhythm-engine.js';
import {
  startMelody,
  stopMelody,
  getMelodyIsPlaying,
  getMelodyMode,
  setMelodyMode,
  toggleSequenceCell,
  previewPitch,
  clearSequence,
  setRootIndex,
  getRootIndex,
  setScale,
  setArpDirection,
  setArpRate,
  getSequence,
  setMelodyStepCallback,
  disposeMelody,
  STEPS_PER_BAR,
  MAX_NOTES_PER_STEP,
  PITCHES,
} from './audio/melody-engine.js';
import { getScalePitchIndices } from './audio/scales.js';
import { DRUM_MODE } from './audio/config.js';

/* ── DOM refs ── */
const powerSwitch = /** @type {HTMLInputElement} */ (document.getElementById('power-switch'));
const powerTrack = document.getElementById('power-track');
const powerLabel = document.getElementById('power-label');
const statusLabel = document.getElementById('status-label');
const ledPower = document.getElementById('led-power');
const ledLofi = document.getElementById('led-lofi');
const drumPadsContainer = document.getElementById('drum-pads');
const lofiBypass = /** @type {HTMLInputElement} */ (document.getElementById('lofi-bypass'));
const engineInfo = document.getElementById('engine-info');

const patternSelect = /** @type {HTMLSelectElement} */ (document.getElementById('pattern-select'));
const tempoDown = document.getElementById('tempo-down');
const tempoUp = document.getElementById('tempo-up');
const tempoDisplay = document.getElementById('tempo-display');
const rhythmStart = document.getElementById('rhythm-start');
const fillInBtn = document.getElementById('fill-in');
const stepGrid = document.getElementById('step-grid');
const rhythmStatus = document.getElementById('rhythm-status');

const modeSequencer = document.getElementById('mode-sequencer');
const modeArpeggiator = document.getElementById('mode-arpeggiator');
const melodyStart = document.getElementById('melody-start');
const melodyClear = document.getElementById('melody-clear');
const melodyStatus = document.getElementById('melody-status');
const arpControls = document.getElementById('arp-controls');
const arpRoot = /** @type {HTMLSelectElement} */ (document.getElementById('arp-root'));
const arpScale = /** @type {HTMLSelectElement} */ (document.getElementById('arp-scale'));
const arpDirection = /** @type {HTMLSelectElement} */ (document.getElementById('arp-direction'));
const arpRate = /** @type {HTMLSelectElement} */ (document.getElementById('arp-rate'));
const melodyGrid = document.getElementById('melody-grid');
const melodyStepsHeader = document.getElementById('melody-steps-header');

/** @type {HTMLButtonElement[]} */
const padButtons = [];

/** @type {HTMLDivElement[]} */
const stepLeds = [];

/** @type {HTMLButtonElement[][]} */
const seqCells = [];

/** @type {HTMLSpanElement[]} */
const stepHeaderLabels = [];

/* ── Rhythm UI ── */

function buildPatternSelect() {
  RHYTHM_PATTERNS.forEach((pattern, index) => {
    const opt = document.createElement('option');
    opt.value = String(index);
    opt.textContent = pattern.name;
    patternSelect?.appendChild(opt);
  });
}

function buildStepGrid() {
  for (let i = 0; i < 16; i++) {
    const led = document.createElement('div');
    led.className = 'step-led';
    led.dataset.step = String(i);
    led.title = `Step ${i + 1}`;
    stepGrid?.appendChild(led);
    stepLeds.push(led);
  }
}

function getGridHits(isFill) {
  const pattern = RHYTHM_PATTERNS[getPatternIndex()];
  if (isFill) {
    const fill = FILL_PATTERNS[pattern.name] ?? DEFAULT_FILL;
    return compositeSteps(fill);
  }
  return compositeSteps(pattern.steps);
}

function updateStepGrid(step, isFill) {
  const hits = getGridHits(isFill);
  stepLeds.forEach((led, i) => {
    led.classList.toggle('has-hit', hits[i] === 1);
    led.classList.toggle('is-playhead', step === i);
    led.classList.toggle('is-fill-bar', isFill && step >= 0);
  });
}

function refreshPatternGrid() {
  const hits = getGridHits(false);
  stepLeds.forEach((led, i) => {
    led.classList.toggle('has-hit', hits[i] === 1);
    led.classList.remove('is-playhead', 'is-fill-bar');
  });
}

function buildDrumPads() {
  Object.values(DRUM_VOICES).forEach((voice) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drum-pad';
    btn.textContent = DRUM_LABELS[voice] ?? voice;
    btn.disabled = true;
    btn.dataset.drum = voice;

    btn.addEventListener('pointerdown', () => {
      if (!getIsPowered()) return;
      btn.classList.add('is-hit');
      triggerDrumSound(voice);
    });

    btn.addEventListener('pointerup', () => btn.classList.remove('is-hit'));
    btn.addEventListener('pointerleave', () => btn.classList.remove('is-hit'));

    drumPadsContainer?.appendChild(btn);
    padButtons.push(btn);
  });
}

function updateTempoDisplay() {
  if (tempoDisplay) tempoDisplay.textContent = String(getTempo());
}

function updateRhythmStatus() {
  if (!rhythmStatus) return;
  const pattern = RHYTHM_PATTERNS[getPatternIndex()];
  rhythmStatus.textContent = getIsPlaying()
    ? `Playing: ${pattern.name} @ ${getTempo()} BPM`
    : `Ready: ${pattern.name} @ ${getTempo()} BPM`;
}

function updateStartButton() {
  if (!rhythmStart) return;
  const playing = getIsPlaying();
  rhythmStart.textContent = playing ? 'Stop' : 'Start';
  rhythmStart.classList.toggle('is-active', playing);
}

/* ── Melody UI ── */

function buildArpRootSelect() {
  PITCHES.forEach((pitch) => {
    const opt = document.createElement('option');
    opt.value = String(pitch.index);
    opt.textContent = pitch.name;
    arpRoot?.appendChild(opt);
  });
  if (arpRoot) arpRoot.value = String(getRootIndex());
}

function buildMelodyStepHeader() {
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    const span = document.createElement('span');
    span.className = 'seq-step-label';
    span.textContent = String(step + 1);
    span.dataset.step = String(step);
    melodyStepsHeader?.appendChild(span);
    stepHeaderLabels.push(span);
  }
}

function buildMelodyGrid() {
  PITCHES.forEach((pitch) => {
    const row = document.createElement('div');
    row.className = 'seq-row';
    row.dataset.pitch = String(pitch.index);

    const label = document.createElement('span');
    label.className = 'seq-row-label';
    label.textContent = pitch.name.replace('#', '♯');
    label.title = `Preview ${pitch.name}`;
    label.addEventListener('click', () => {
      if (!getIsPowered()) return;
      previewPitch(pitch.index);
    });
    row.appendChild(label);

    const cells = document.createElement('div');
    cells.className = 'seq-row-cells';

    /** @type {HTMLButtonElement[]} */
    const rowCells = [];

    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'seq-cell';
      cell.dataset.step = String(step);
      cell.dataset.pitch = String(pitch.index);
      cell.disabled = true;
      cell.title = `${pitch.name} · step ${step + 1}`;

      cell.addEventListener('click', () => onSeqCellClick(pitch.index, step));
      cells.appendChild(cell);
      rowCells.push(cell);
    }

    row.appendChild(cells);
    melodyGrid?.appendChild(row);
    seqCells.push(rowCells);
  });
}

/**
 * @param {number} pitchIndex
 * @param {number} step
 */
function onSeqCellClick(pitchIndex, step) {
  if (!getIsPowered()) return;

  if (getMelodyMode() === 'arpeggiator') {
    setRootIndex(pitchIndex);
    if (arpRoot) arpRoot.value = String(pitchIndex);
    refreshMelodyGrid(-1);
    previewPitch(pitchIndex);
    return;
  }

  const ok = toggleSequenceCell(step, pitchIndex);
  if (!ok) {
    flashMelodyStatus(`Max ${MAX_NOTES_PER_STEP} notes per step`);
    return;
  }
  refreshMelodyGrid(-1);
  previewPitch(pitchIndex);
}

function refreshMelodyGrid(playheadStep) {
  const sequence = getSequence();
  const mode = getMelodyMode();
  const root = getRootIndex();
  const scaleIndices = mode === 'arpeggiator'
    ? new Set(getScalePitchIndices(root, /** @type {import('./audio/scales.js').ScaleName} */ (arpScale?.value ?? 'major')))
    : null;

  seqCells.forEach((rowCells, pitchIndex) => {
    const rowLabel = melodyGrid?.querySelector(`.seq-row[data-pitch="${pitchIndex}"] .seq-row-label`);
    rowLabel?.classList.toggle('is-root', mode === 'arpeggiator' && pitchIndex === root);

    rowCells.forEach((cell, step) => {
      const active = sequence[step]?.includes(pitchIndex) ?? false;
      cell.classList.toggle('is-active', active);
      cell.classList.toggle('is-scale', scaleIndices?.has(pitchIndex) ?? false);
      cell.classList.toggle('is-root-row', mode === 'arpeggiator' && pitchIndex === root);
      cell.classList.toggle('is-playhead-col', playheadStep === step);
    });
  });

  stepHeaderLabels.forEach((label, step) => {
    label.classList.toggle('is-playhead', playheadStep === step);
  });
}

function updateMelodyModeUI() {
  const mode = getMelodyMode();
  modeSequencer?.classList.toggle('is-selected', mode === 'sequencer');
  modeArpeggiator?.classList.toggle('is-selected', mode === 'arpeggiator');
  arpControls?.classList.toggle('hidden', mode !== 'arpeggiator');
  refreshMelodyGrid(getMelodyIsPlaying() ? -1 : -1);
}

function updateMelodyStartButton() {
  if (!melodyStart) return;
  const playing = getMelodyIsPlaying();
  melodyStart.textContent = playing ? 'Stop Melody' : 'Play Melody';
  melodyStart.classList.toggle('is-active', playing);
}

function updateMelodyStatus() {
  if (!melodyStatus) return;
  const mode = getMelodyMode();
  const tempo = getTempo();
  if (mode === 'sequencer') {
    melodyStatus.textContent = getMelodyIsPlaying()
      ? `Sequencer @ ${tempo} BPM`
      : `Sequencer · click cells · max ${MAX_NOTES_PER_STEP}/step`;
  } else {
    const root = PITCHES[getRootIndex()];
    melodyStatus.textContent = getMelodyIsPlaying()
      ? `Arp ${root?.name} · ${tempo} BPM`
      : `Arp · click row to set root · ${root?.name ?? '—'}`;
  }
}

function flashMelodyStatus(msg) {
  if (!melodyStatus) return;
  melodyStatus.textContent = msg;
  window.setTimeout(() => updateMelodyStatus(), 1500);
}

/* ── Shared power / enable ── */

/** @param {boolean} enabled */
function setControlsEnabled(enabled) {
  patternSelect.disabled = !enabled;
  tempoDown?.toggleAttribute('disabled', !enabled);
  tempoUp?.toggleAttribute('disabled', !enabled);
  rhythmStart?.toggleAttribute('disabled', !enabled);
  fillInBtn?.toggleAttribute('disabled', !enabled);
  padButtons.forEach((btn) => { btn.disabled = !enabled; });

  modeSequencer?.toggleAttribute('disabled', !enabled);
  modeArpeggiator?.toggleAttribute('disabled', !enabled);
  melodyStart?.toggleAttribute('disabled', !enabled);
  melodyClear?.toggleAttribute('disabled', !enabled);
  arpRoot && (arpRoot.disabled = !enabled);
  arpScale && (arpScale.disabled = !enabled);
  arpDirection && (arpDirection.disabled = !enabled);
  arpRate && (arpRate.disabled = !enabled);

  seqCells.forEach((row) => {
    row.forEach((cell) => { cell.disabled = !enabled; });
  });
}

function updatePowerUI(on) {
  powerTrack?.classList.toggle('is-on', on);
  powerLabel.textContent = on ? 'PLAY' : 'OFF';
  statusLabel.textContent = on ? 'PLAY' : 'POWER OFF';
  ledPower?.classList.toggle('is-on', on);
  ledLofi?.classList.toggle('is-on', on);
  setControlsEnabled(on);
  engineInfo.textContent = getEngineInfo() + ` · drums ${DRUM_MODE}`;
  updateTempoDisplay();
  updateRhythmStatus();
  updateStartButton();
  updateMelodyStartButton();
  updateMelodyStatus();
  refreshMelodyGrid(-1);
  if (!on) refreshPatternGrid();
}

/* ── Event listeners ── */

powerSwitch?.addEventListener('change', async () => {
  try {
    if (powerSwitch.checked) {
      await powerOn();
      updatePowerUI(true);
    } else {
      disposeMelody();
      disposeRhythm();
      await powerOff();
      updatePowerUI(false);
    }
  } catch (err) {
    console.error('[SK-1] Audio init failed:', err);
    powerSwitch.checked = false;
    updatePowerUI(false);
    statusLabel.textContent = 'AUDIO ERROR';
  }
});

lofiBypass?.addEventListener('change', () => {
  setLofiBypass(lofiBypass.checked);
});

patternSelect?.addEventListener('change', () => {
  setPattern(Number(patternSelect.value));
  refreshPatternGrid();
  updateRhythmStatus();
});

tempoDown?.addEventListener('click', () => {
  nudgeTempo(-1);
  updateTempoDisplay();
  updateRhythmStatus();
  updateMelodyStatus();
});

tempoUp?.addEventListener('click', () => {
  nudgeTempo(1);
  updateTempoDisplay();
  updateRhythmStatus();
  updateMelodyStatus();
});

rhythmStart?.addEventListener('click', () => {
  if (getIsPlaying()) stopRhythm();
  else startRhythm();
  updateStartButton();
  updateRhythmStatus();
});

fillInBtn?.addEventListener('click', () => {
  triggerFillIn();
});

setStepCallback((step, isFill) => {
  if (step < 0) {
    if (!getIsPlaying()) refreshPatternGrid();
    return;
  }
  updateStepGrid(step, isFill);
});

modeSequencer?.addEventListener('click', () => {
  setMelodyMode('sequencer');
  updateMelodyModeUI();
  updateMelodyStatus();
});

modeArpeggiator?.addEventListener('click', () => {
  setMelodyMode('arpeggiator');
  updateMelodyModeUI();
  updateMelodyStatus();
});

melodyStart?.addEventListener('click', () => {
  if (getMelodyIsPlaying()) stopMelody();
  else startMelody();
  updateMelodyStartButton();
  updateMelodyStatus();
});

melodyClear?.addEventListener('click', () => {
  clearSequence();
  refreshMelodyGrid(-1);
});

arpRoot?.addEventListener('change', () => {
  setRootIndex(Number(arpRoot.value));
  refreshMelodyGrid(-1);
  updateMelodyStatus();
});

arpScale?.addEventListener('change', () => {
  setScale(/** @type {import('./audio/scales.js').ScaleName} */ (arpScale.value));
  refreshMelodyGrid(-1);
});

arpDirection?.addEventListener('change', () => {
  setArpDirection(/** @type {import('./audio/scales.js').ArpDirection} */ (arpDirection.value));
});

arpRate?.addEventListener('change', () => {
  setArpRate(/** @type {import('./audio/melody-engine.js').ArpRate} */ (arpRate.value));
});

setMelodyStepCallback((step) => {
  if (step < 0) {
    refreshMelodyGrid(-1);
    return;
  }
  refreshMelodyGrid(step);
});

/* ── Init ── */
buildPatternSelect();
buildStepGrid();
buildDrumPads();
buildArpRootSelect();
buildMelodyStepHeader();
buildMelodyGrid();
refreshPatternGrid();
updateMelodyModeUI();
updatePowerUI(false);
