import type { Page } from '@playwright/test';

declare global {
  interface Window {
    soundProbe: { frequencies: number[]; starts: number; peak: number; contexts: number };
  }
}

// Keep native Web Audio running: observe scheduled notes and real rendered samples.
export async function observeSounds(page: Page) {
  await page.addInitScript(() => {
    window.soundProbe = { frequencies: [], starts: 0, peak: 0, contexts: 0 };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      private analyser: AnalyserNode;
      constructor(options?: AudioContextOptions) {
        super(options);
        window.soundProbe.contexts++;
        this.analyser = super.createAnalyser();
        const silent = super.createGain();
        silent.gain.value = 0;
        this.analyser.connect(silent);
        silent.connect(this.destination);
        const samples = new Float32Array(this.analyser.fftSize);
        const sample = () => {
          if (this.state === 'closed') return;
          this.analyser.getFloatTimeDomainData(samples);
          for (const value of samples)
            window.soundProbe.peak = Math.max(window.soundProbe.peak, Math.abs(value));
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
      createGain() {
        const gain = super.createGain();
        gain.connect(this.analyser);
        return gain;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, time) => {
          window.soundProbe.frequencies.push(value);
          return set(value, time);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.soundProbe.starts++;
          start(when);
        };
        return oscillator;
      }
    };
  });
}

export async function clearSounds(page: Page) {
  await page.evaluate(() => {
    window.soundProbe.frequencies = [];
    window.soundProbe.starts = 0;
    window.soundProbe.peak = 0;
  });
}
