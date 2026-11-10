// Procedural Web Audio API Sound Effects for BLADE RIVALS
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.muted = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 1.5s white noise buffer
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (e) {
      // Ignore audio errors in restricted environments
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.setVolume(this.volume);
  }

  _ready() {
    this.init();
    return !!(this.ctx && this.masterGain && !this.muted);
  }

  playSlash(combo = 0, isFist = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Air whoosh via filtered noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = isFist ? 320 : 900 + combo * 220;
    filter.frequency.setValueAtTime(baseFreq * 1.6, t);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, t + 0.16);
    filter.Q.value = isFist ? 1.8 : 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(isFist ? 0.25 : 0.34, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.19);

    if (!isFist) {
      // Subtle metallic blade ring
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200 + combo * 300, t);
      osc.frequency.exponentialRampToValueAtTime(950, t + 0.11);
      const oGain = this.ctx.createGain();
      oGain.gain.setValueAtTime(0.09, t);
      oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(oGain);
      oGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  playChargeStart() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(1180, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.29);
  }

  playThrow(charged = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Sharp whip noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(350, t + 0.18);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(charged ? 0.45 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.21);

    // Blade zing
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(charged ? 1850 : 1400, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.16);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.14, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playEnemyTelegraph() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // Distinct metallic glint cue so player knows a throw is coming!
    [1680, 2520].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, t + idx * 0.04 + 0.22);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, t + idx * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.26);
    });
  }

  playParryStance() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(1560, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  playParrySuccess(isDeflect = true) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Iconic metallic clang chord (katana parry resonance)
    const freqs = isDeflect ? [1318, 1975, 2960, 4186] : [1046, 1568, 2489];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.55);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26 / (i + 1), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.56);
    });

    // Sub punch impact
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(210, t);
    sub.frequency.exponentialRampToValueAtTime(48, t + 0.22);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.45, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.24);
  }

  playHit(isCrit = false, isKill = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Crisp FPS hitmarker tick
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 1950 : 1250, t);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 880 : 420, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.095);

    if (isCrit || isKill) {
      // Satisfying Rivals headshot / kill bell ding!
      const bell = this.ctx.createOscillator();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(isKill ? 2349 : 1760, t + 0.02);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.3, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      bell.connect(bg);
      bg.connect(this.masterGain);
      bell.start(t + 0.02);
      bell.stop(t + 0.43);
    }
  }

  playHurt() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  playKnifeStick() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // Thud + blade vibration twang
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  playKnifePickup() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [880, 1320].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.045);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, t + idx * 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.12);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + idx * 0.045);
      osc.stop(t + idx * 0.045 + 0.13);
    });
  }

  playJump(isDouble = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDouble ? 360 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(isDouble ? 680 : 410, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  playJumpPad() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.31);
  }

  playSlide() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.32);
    filter.Q.value = 1.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.35);
  }

  playDash() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.18);
    filter.Q.value = 2.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.2);
  }

  playInspectClick() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.04);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playCountdown(isGo = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = isGo ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, t);
    if (isGo) osc.frequency.setValueAtTime(1174.66, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.36 : 0.18));
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + (isGo ? 0.37 : 0.19));
  }

  playHeadshot() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // Crisp Rivals Headshot CRACK + Dual Crystal Bell Ding!
    [2093, 2637, 3136].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.025);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.32 / (i * 0.6 + 1), t + i * 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.025 + 0.48);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.025);
      osc.stop(t + i * 0.025 + 0.5);
    });
  }

  playCaseTick(pitch = 1.0) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(650 * pitch, t + 0.028);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.035);
  }

  playCaseUnbox(tier = 2) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const chords = [
      [523.25, 659.25, 783.99],
      [587.33, 739.99, 880.0, 1174.66],
      [659.25, 830.61, 987.77, 1318.5, 1661.2],
      [783.99, 987.77, 1174.66, 1567.98, 1975.5, 2349.3]
    ];
    const notes = chords[Math.min(chords.length - 1, Math.max(0, tier))];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.065);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, t + i * 0.065);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.065 + 0.65);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.065);
      osc.stop(t + i * 0.065 + 0.68);
    });
  }

  playRoundEnd(won = true) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 311.13, 261.63];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = won ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.35);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.36);
    });
  }

  playKillEffect(effectId = 'voxel_classic') {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    if (effectId === 'lightning_strike') {
      // Thunder crack + electric descending zap
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + 0.55);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
      noise.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.6);

      const zap = this.ctx.createOscillator();
      zap.type = 'sawtooth';
      zap.frequency.setValueAtTime(1900, t);
      zap.frequency.exponentialRampToValueAtTime(95, t + 0.28);
      const zg = this.ctx.createGain();
      zg.gain.setValueAtTime(0.26, t);
      zg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      zap.connect(zg);
      zg.connect(this.masterGain);
      zap.start(t);
      zap.stop(t + 0.31);
    } else if (effectId === 'ice_shatter') {
      [1760, 2349, 2793, 3520].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.03);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, t + i * 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t + i * 0.03);
        osc.stop(t + 0.34);
      });
    } else if (effectId === 'golden_statue') {
      [440, 659.25, 880, 1318.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.04);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t + i * 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t + i * 0.04);
        osc.stop(t + 0.58);
      });
    } else if (effectId === 'void_vortex') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.55);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.62);
    } else if (effectId === 'confetti_party') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.045);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, t + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.28);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t + i * 0.045);
        osc.stop(t + i * 0.045 + 0.3);
      });
    }
  }

  playStormTick() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(72, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  playStormPhaseAlert() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [330, 440, 330].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.14);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.13);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.14);
      osc.stop(t + i * 0.14 + 0.14);
    });
  }

  playTargetDing() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(1960, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  playVault() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // Tactile palm slap on ledge
    const thud = this.ctx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(165, t);
    thud.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.28, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.11);

    // Parkour hurdle air whoosh
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, t + 0.03);
    filter.frequency.exponentialRampToValueAtTime(1450, t + 0.22);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.masterGain);
    noise.start(t + 0.03);
    noise.stop(t + 0.25);
  }

  playAbilityCast(abilityId = 'ability_rage') {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const notes =
      abilityId === 'ability_rage'
        ? [220, 330, 440, 660]
        : abilityId === 'ability_chrono_blade'
        ? [523.25, 783.99, 1046.5, 1567.98]
        : [392, 587.33, 783.99];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.24);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.25);
    });
  }
}

export const sfx = new SoundEngine();
