/**
 * Train whistle/bell audio — small WebAudio synth, no assets.
 * Soft ambient volumes, lazily created AudioContext (resumed on the first
 * pointer interaction, per browser autoplay rules). Globally toggleable.
 *
 * Volume buses: master → train (whistle/bell) and crossing (bell/motor).
 */

const VOLUME = 0.045; // soft — ambient flavor, never intrusive

class TrainAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.lastWhistle = 0;
    this.volumes = { master: 1, train: 1, crossing: 1 };
    this.buses = { master: null, train: null, crossing: null };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', () => this.resume(), { once: true });
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.ctx) this.ctx.suspend();
    else if (on && this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(volumes) {
    this.volumes = { ...this.volumes, ...volumes };
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.buses.master) this.buses.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    if (this.buses.train) this.buses.train.gain.setTargetAtTime(this.volumes.train, t, 0.05);
    if (this.buses.crossing) this.buses.crossing.gain.setTargetAtTime(this.volumes.crossing, t, 0.05);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = this.ctx.createGain();
        master.connect(this.ctx.destination);
        const train = this.ctx.createGain();
        train.connect(master);
        const crossing = this.ctx.createGain();
        crossing.connect(master);
        this.buses = { master, train, crossing };
        this.applyVolumes();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** Voice gain helper: base volume × bus volumes. */
  voiceGain(ctx, base, bus) {
    const gain = ctx.createGain();
    const busGain = this.buses[bus];
    if (busGain) gain.connect(busGain);
    else gain.connect(ctx.destination);
    gain.gain.value = base;
    return gain;
  }

  /** Steam whistle: two detuned tones with vibrato + breath noise. */
  whistle() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastWhistle < 4000) return; // no whistle spam
    this.lastWhistle = now;
    const t0 = ctx.currentTime;

    const gain = this.voiceGain(ctx, 0.0001, 'train');
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + 0.18);
    gain.gain.setValueAtTime(VOLUME, t0 + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(430, t0);
    osc1.frequency.linearRampToValueAtTime(500, t0 + 0.25);
    osc1.frequency.linearRampToValueAtTime(440, t0 + 1.0);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(645, t0);
    osc2.frequency.linearRampToValueAtTime(750, t0 + 0.25);
    osc2.frequency.linearRampToValueAtTime(660, t0 + 1.0);

    // Gentle vibrato on the whistle body
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfo.start(t0);
    lfo.stop(t0 + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + 1.2);
    osc2.stop(t0 + 1.2);
  }

  /** Station bell: three short decays. */
  bell() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.22;
      const gain = this.voiceGain(ctx, VOLUME * 0.8, 'train');
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOLUME * 0.8, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1318; // E6
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  }

  /** Crossing bell: single ding (cadence driven by the crossing state). */
  crossingBell() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const gain = this.voiceGain(ctx, VOLUME * 0.7, 'crossing');
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(VOLUME * 0.7, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1245; // ~D#6 — softer than the station bell
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  /** Crossing gate motor: short low buzz while arms move. */
  gateMotor() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const gain = this.voiceGain(ctx, VOLUME * 0.5, 'crossing');
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(VOLUME * 0.5, t0 + 0.05);
    gain.gain.setValueAtTime(VOLUME * 0.5, t0 + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t0);
    osc.frequency.linearRampToValueAtTime(48, t0 + 0.95);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + 1.0);
  }
}

export const trainAudio = new TrainAudio();
