// bitcrusher-processor.js
class BitCrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'srFactor', defaultValue: 50 },
      { name: 'bitDepth', defaultValue: 8 },
      { name: 'clip', defaultValue: 1 }
    ];
  }

  constructor() {
    super();
    this.lastSample = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length === 0) return true;

    const inCh = input[0];
    const outCh = output[0];

    const srFactor = parameters.srFactor.length > 0 ? parameters.srFactor[0] : 50;
    const bitDepth = parameters.bitDepth.length > 0 ? parameters.bitDepth[0] : 8;
    const clip = parameters.clip.length > 0 ? parameters.clip[0] : 1;
    const step = Math.floor(50 / srFactor) || 1;
    const levels = Math.pow(2, bitDepth);

    for (let i = 0; i < inCh.length; i++) {
      let s = (i % step === 0) ? inCh[i] : this.lastSample;
      this.lastSample = s;

      s = s / clip;
      s = Math.max(-1, Math.min(1, s));
      s = Math.round(s * (levels/2)) / (levels/2);

      outCh[i] = s;
    }

    return true;
  }
}

registerProcessor('bitcrusher-processor', BitCrusherProcessor);