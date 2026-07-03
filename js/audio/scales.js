/**
 * @file Musical scales for arpeggiator mode.
 */
import { PITCHES, START_MIDI } from './notes.js';

/** @typedef {'major' | 'minor' | 'pentatonic' | 'blues'} ScaleName */
/** @typedef {'up' | 'down' | 'updown' | 'random'} ArpDirection */

/** Semitone intervals within one octave (0 = root) */
export const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues:      [0, 3, 5, 6, 7, 10],
};

export const SCALE_LABELS = {
  major: 'Major',
  minor: 'Minor',
  pentatonic: 'Pentatonic',
  blues: 'Blues',
};

export const ARP_DIRECTIONS = ['up', 'down', 'updown', 'random'];

export const ARP_DIRECTION_LABELS = {
  up: 'Up',
  down: 'Down',
  updown: 'Up-Down',
  random: 'Random',
};

/** @type {ScaleName[]} */
export const SCALE_NAMES = Object.keys(SCALES);

/**
 * Pitch indices (F3–C6 grid rows) that belong to the scale from a given root.
 * @param {number} rootIndex
 * @param {ScaleName} scaleName
 * @returns {number[]}
 */
export function getScalePitchIndices(rootIndex, scaleName) {
  const intervals = SCALES[scaleName] ?? SCALES.major;
  const rootMidi = PITCHES[rootIndex]?.midi ?? START_MIDI;
  const indices = [];

  for (const pitch of PITCHES) {
    const rel = ((pitch.midi - rootMidi) % 12 + 12) % 12;
    if (intervals.includes(rel)) {
      indices.push(pitch.index);
    }
  }

  return indices;
}

/**
 * Build arpeggio order for one cycle.
 * @param {number[]} scaleIndices sorted pitch indices
 * @param {ArpDirection} direction
 * @returns {number[]}
 */
export function buildArpOrder(scaleIndices, direction) {
  if (scaleIndices.length === 0) return [];

  switch (direction) {
    case 'up':
      return [...scaleIndices];
    case 'down':
      return [...scaleIndices].reverse();
    case 'updown': {
      if (scaleIndices.length <= 1) return [...scaleIndices];
      const up = [...scaleIndices];
      const down = [...scaleIndices].reverse().slice(1, -1);
      return up.concat(down);
    }
    case 'random':
      return [...scaleIndices].sort(() => Math.random() - 0.5);
    default:
      return [...scaleIndices];
  }
}
