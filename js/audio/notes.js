/**
 * @file Pitch map — F3 through C6 (2.5 octaves, 32 mini-key range).
 */

/** @typedef {{ index: number, midi: number, name: string, freq: number }} Pitch */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const START_MIDI = 53; // F3
export const END_MIDI = 84;   // C6

/** @type {Pitch[]} */
export const PITCHES = [];

for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  PITCHES.push({
    index: midi - START_MIDI,
    midi,
    name: `${NOTE_NAMES[midi % 12]}${octave}`,
    freq: 440 * Math.pow(2, (midi - 69) / 12),
  });
}

export const PITCH_COUNT = PITCHES.length;

/**
 * @param {number} pitchIndex
 * @returns {Pitch | undefined}
 */
export function getPitch(pitchIndex) {
  return PITCHES[pitchIndex];
}

/**
 * @param {number} midi
 * @returns {number} pitch index, or -1 if out of range
 */
export function midiToIndex(midi) {
  if (midi < START_MIDI || midi > END_MIDI) return -1;
  return midi - START_MIDI;
}

/** Default root: C4 */
export const DEFAULT_ROOT_INDEX = midiToIndex(60);
