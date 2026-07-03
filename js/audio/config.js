/** @file Global audio configuration */

/** @typedef {'SYNTH' | 'SAMPLE'} DrumMode */

/** Toggle to 'SAMPLE' when external .wav buffers are wired up */
export const DRUM_MODE = 'SYNTH';

/** Authentic SK-1 internal PCM rate (Hz) */
export const SK1_SAMPLE_RATE = 9340;

/** Main synthesizer polyphony limit */
export const MAX_POLYPHONY = 4;

/** Default master output level */
export const MASTER_GAIN = 0.7;
