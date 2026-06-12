class AudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      } catch (e) {
        console.warn('Web Audio API is not supported in this browser:', e);
      }
    }
    // Resume context if suspended (browser security policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && !muted && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    const nextVal = !this.isMuted;
    this.setMute(nextVal);
    return nextVal;
  }

  private createOscillator(
    type: OscillatorType,
    freqs: number[],
    durations: number[],
    volCurve: number[]
  ) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Program Frequency
      osc.frequency.setValueAtTime(freqs[0], now);
      let currentOffset = 0;
      for (let i = 1; i < freqs.length; i++) {
        currentOffset += durations[i - 1];
        osc.frequency.exponentialRampToValueAtTime(freqs[i], now + currentOffset);
      }

      // Program Volume (Gain)
      gain.gain.setValueAtTime(0, now);
      let volOffset = 0;
      const totalDur = durations.reduce((a, b) => a + b, 0);
      
      // Fine-grained volume curve
      gain.gain.linearRampToValueAtTime(volCurve[0], now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

      osc.start(now);
      osc.stop(now + totalDur + 0.05);
    } catch (e) {
      console.error('Audio synthesis failed:', e);
    }
  }

  public playJump() {
    this.createOscillator('square', [140, 480], [0.12], [0.15]);
  }

  public playCoin() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      
      const playBeep = (freq: number, startDelay: number, dur: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + startDelay);
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.001, now + startDelay);
        gain.gain.linearRampToValueAtTime(0.18, now + startDelay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + dur);

        osc.start(now + startDelay);
        osc.stop(now + startDelay + dur + 0.02);
      };

      // Perfect golden chime / ring arcade coin sound
      playBeep(523.25, 0, 0.09); // C5
      playBeep(783.99, 0.08, 0.18); // G5
    } catch (e) {
      console.error(e);
    }
  }

  public playKey() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const playChime = (freq: number, startDelay: number, dur: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startDelay);
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.001, now + startDelay);
        gain.gain.linearRampToValueAtTime(0.12, now + startDelay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + dur);

        osc.start(now + startDelay);
        osc.stop(now + startDelay + dur + 0.02);
      };

      playChime(587.33, 0, 0.08); // D5
      playChime(659.25, 0.06, 0.08); // E5
      playChime(880.00, 0.12, 0.15); // A5
    } catch (e) {
      console.error(e);
    }
  }

  public playUnlock() {
    // Solid clunky unlocked door noise
    this.createOscillator('triangle', [180, 90, 60], [0.1, 0.1], [0.25]);
  }

  public playHit() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Synthesized retro explosions using white noise + bandpass or a rapid multi-oscillator pitch drop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(100, now + 0.05);
      osc.frequency.linearRampToValueAtTime(20, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.error(e);
    }
  }

  public playWin() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const playTone = (freq: number, start: number, dur: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      };

      // Joyous triumphal 8-bit chord arpeggio
      playTone(523.25, 0.0, 0.1); // C5
      playTone(659.25, 0.1, 0.1); // E5
      playTone(783.99, 0.2, 0.1); // G5
      playTone(1046.50, 0.3, 0.3); // C6
    } catch (e) {
      console.error(e);
    }
  }
}

export const sound = new AudioSynth();
