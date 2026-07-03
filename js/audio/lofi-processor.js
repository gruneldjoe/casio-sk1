/**
 * LoFiProcessor — emulates SK-1 8-bit PCM @ 9.34 kHz
 *
 * Sample-and-hold downsampling creates authentic aliasing,
 * followed by 8-bit amplitude quantization (256 levels).
 */
const SK1_SAMPLE_RATE = 9340;
const BIT_DEPTH = 8;
const QUANT_LEVELS = Math.pow(2, BIT_DEPTH);

class LoFiProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / SK1_SAMPLE_RATE;
    this.phase = 0;
    this.heldSample = 0;
    this.bypass = false;

    this.port.onmessage = (event) => {
      if (event.data?.type === 'setBypass') {
        this.bypass = !!event.data.value;
      }
    };
  }

  quantize(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const scaled = (clamped + 1) * 0.5 * (QUANT_LEVELS - 1);
    return (Math.round(scaled) / (QUANT_LEVELS - 1)) * 2 - 1;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const outL = outputs[0]?.[0];
    const outR = outputs[0]?.[1];

    if (!outL) return true;

    if (this.bypass || !input) {
      for (let i = 0; i < outL.length; i++) {
        const s = input ? input[i] : 0;
        outL[i] = s;
        if (outR) outR[i] = s;
      }
      return true;
    }

    for (let i = 0; i < outL.length; i++) {
      this.phase += 1;
      if (this.phase >= this.ratio) {
        this.phase -= this.ratio;
        this.heldSample = this.quantize(input[i]);
      }
      outL[i] = this.heldSample;
      if (outR) outR[i] = this.heldSample;
    }

    return true;
  }
}

registerProcessor('lofi-processor', LoFiProcessor);
