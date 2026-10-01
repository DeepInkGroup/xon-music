/* Audio thread only buffers samples. Pitch analysis runs in a dedicated worker. */
class PianoCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = sampleRate <= 24000 ? 4096 : sampleRate <= 48000 ? 8192 : 16384;
    this.hop = this.size / 4;
    this.ring = new Float32Array(this.size);
    this.position = 0;
    this.count = 0;
    this.sinceLast = 0;
    this.busy = false;
    this.port.onmessage = () => { this.busy = false; };
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (let channel = 0; channel < channels.length; channel++) sample += channels[channel][i];
      this.ring[this.position] = sample / channels.length;
      this.position = (this.position + 1) % this.size;
      this.count++;
      this.sinceLast++;
    }
    if (this.count >= this.size && this.sinceLast >= this.hop && !this.busy) {
      const samples = new Float32Array(this.size);
      for (let i = 0; i < this.size; i++) samples[i] = this.ring[(this.position + i) % this.size];
      this.port.postMessage({ samples, sampleRate, timestamp: currentTime + channels[0].length / sampleRate }, [samples.buffer]);
      this.sinceLast = 0;
      this.busy = true;
    }
    // Outputs are zero-filled by Web Audio: microphone audio is never played back.
    return true;
  }
}
registerProcessor('piano-capture', PianoCapture);
