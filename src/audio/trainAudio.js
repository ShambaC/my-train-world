/**
 * Train whistle/bell audio — small WebAudio synth, no assets.
 * Soft ambient volumes, lazily created AudioContext (resumed on the first
 * pointer interaction, per browser autoplay rules). Globally toggleable.
 */

const VOLUME = 0.045; // soft — ambient flavor, never intrusive

class TrainAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.lastWhistle = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', () => this.resume(), { once: true });
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.ctx) this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** Steam whistle: two detuned tones with vibrato + breath noise. */
  whistle() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastWhistle < 4000) return; // no whistle spam
    this.lastWhistle = now;
    const t0 = ctx.currentTime;

    const gain = ctx.createGain();
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
    gain.connect(ctx.destination);
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
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOLUME * 0.8, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1318; // E6
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  }
}

export const trainAudio = new TrainAudio();
