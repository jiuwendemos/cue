/**
 * The public demo's track is synthesised here, from the same energy curve the
 * timeline draws. No recording, no sample pack, no network request. It exists so
 * the 90-second stage piece has sound and the scrub has a preview without
 * pretending to be the artist's record.
 */

type AudioCtor = typeof AudioContext;

function contextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class ShowAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;
  private energy = 0.55;
  private playing = false;
  private muted = false;
  private volume = 0.62;

  get isPlaying(): boolean {
    return this.playing;
  }

  ensure(): AudioContext | null {
    const Ctor = contextCtor();
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = 0;
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.22;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 6000;
      filter.Q.value = 0.4;
      filter.connect(master);
      master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.master = master;
      this.filter = filter;
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    return buffer;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.playing ? this.volume : 0, this.ctx.currentTime, 0.04);
    }
  }

  get mutedState(): boolean {
    return this.muted;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.ctx && this.playing && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setEnergy(energy: number): void {
    this.energy = Math.max(0, Math.min(1, energy));
    if (this.filter && this.ctx) {
      this.filter.frequency.setTargetAtTime(900 + this.energy * 9000, this.ctx.currentTime, 0.18);
    }
  }

  start(energy: number): void {
    const ctx = this.ensure();
    if (!ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.setEnergy(energy);
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.master.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : this.volume, ctx.currentTime + 0.35);
    }
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 118);
  }

  stop(): void {
    this.playing = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  /** A short, one-shot preview used when the designer scrubs while paused. */
  scrubPreview(energy: number): void {
    const ctx = this.ensure();
    if (!ctx || this.playing) return;
    this.setEnergy(energy);
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.master.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : this.volume * 0.5, ctx.currentTime + 0.02);
      this.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
    }
    const now = ctx.currentTime + 0.01;
    this.kick(now, this.energy * 0.7);
    this.chord(now, this.energy);
    this.hat(now + 0.12, this.energy * 0.4);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    this.setEnergy(this.energy);
    const now = ctx.currentTime + 0.04;
    const step = this.step % 16;
    const e = this.energy;
    if (step % 4 === 0) this.kick(now, e);
    if (step === 4 || step === 12) this.snare(now, e);
    if (step % 2 === 1) this.hat(now, e);
    if (step % 2 === 0) this.bass(now, step, e);
    if (step === 0) this.chord(now, e);
    if (e > 0.8 && (step === 14 || step === 15)) this.riser(now, e);
    this.step += 1;
  }

  private kick(at: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, at);
    osc.frequency.exponentialRampToValueAtTime(44, at + 0.16);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5 + energy * 0.35, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  private bass(at: number, step: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master) return;
    const notes = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    const freq = notes[Math.floor(step / 2) % notes.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220 + energy * 900, at);
    filter.Q.value = 6;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.06 + energy * 0.11, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.24);
  }

  private hat(at: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master || !this.noise) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    src.buffer = this.noise;
    hp.type = "highpass";
    hp.frequency.value = 7000;
    gain.gain.setValueAtTime(0.14 * (0.4 + energy), at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(master);
    src.start(at);
    src.stop(at + 0.08);
  }

  private snare(at: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master || !this.noise) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const band = ctx.createBiquadFilter();
    src.buffer = this.noise;
    band.type = "bandpass";
    band.frequency.value = 1800;
    band.Q.value = 0.8;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08 + energy * 0.1, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    src.connect(band);
    band.connect(gain);
    gain.connect(master);
    src.start(at);
    src.stop(at + 0.16);
  }

  private chord(at: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master) return;
    const roots = [110, 110, 98, 87.31];
    const root = roots[Math.floor(this.step / 64) % roots.length];
    const ratios = [1, 1.5, 2, 2.5];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.014 + energy * 0.018, at + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
    for (const ratio of ratios) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = root * ratio;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 2.3);
    }
    gain.connect(master);
  }

  private riser(at: number, energy: number): void {
    const ctx = this.ctx;
    const master = this.filter;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, at);
    osc.frequency.exponentialRampToValueAtTime(880, at + 0.22);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, at);
    filter.frequency.exponentialRampToValueAtTime(4000, at + 0.22);
    filter.Q.value = 1.2;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.02 + energy * 0.02, at + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.26);
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const showAudio = new ShowAudio();
