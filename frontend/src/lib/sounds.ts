export type SoundCue =
  | 'button'
  | 'navigation'
  | 'menu'
  | 'jump'
  | 'collect'
  | 'remove'
  | 'correct'
  | 'incorrect'
  | 'bridge'
  | 'victory';
export type SoundSettings = { enabled: boolean; volume: number };
export const soundSettingsKey = 'wonderlab.sound.v1';
export const defaultSoundSettings: SoundSettings = { enabled: true, volume: 0.3 };
export function readSoundSettings(raw: string | null): SoundSettings {
  try {
    const value = JSON.parse(raw || '{}');
    return {
      enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
      volume:
        typeof value?.volume === 'number' && Number.isFinite(value.volume)
          ? Math.max(0, Math.min(1, value.volume))
          : 0.3,
    };
  } catch {
    return { ...defaultSoundSettings };
  }
}

type Tone = { frequency: number; at: number; duration: number; to?: number; wave?: OscillatorType };
const note = (frequency: number, at = 0, duration = 0.12, to?: number): Tone => ({
  frequency,
  at,
  duration,
  to,
});
// Quiet, rounded sine/triangle notes. Every voice has a soft attack and a bounded release.
const cues: Record<SoundCue, Tone[]> = {
  button: [note(520, 0, 0.065, 440)],
  navigation: [note(392, 0, 0.09), note(587, 0.065, 0.12)],
  menu: [note(440, 0, 0.075), note(523, 0.05, 0.09)],
  jump: [{ ...note(220, 0, 0.16, 620), wave: 'triangle' }],
  collect: [note(784, 0, 0.08), note(1047, 0.06, 0.14)],
  remove: [note(660, 0, 0.1, 330)],
  correct: [note(523, 0, 0.16), note(659, 0.1, 0.16), note(784, 0.2, 0.22)],
  incorrect: [note(330, 0, 0.13), note(294, 0.1, 0.18)],
  bridge: [note(392, 0, 0.14), note(523, 0.1, 0.14), note(659, 0.2, 0.14), note(784, 0.3, 0.24)],
  victory: [note(523, 0, 0.18), note(659, 0.13, 0.18), note(784, 0.26, 0.18), note(1047, 0.4, 0.4)],
};

export class SoundTransport {
  private context: AudioContext | null = null;
  private unlocked = false;
  private visible = true;
  private disposed = false;
  private revision = 0;
  private voices = new Map<OscillatorNode, GainNode>();
  private lastPlayed = new Map<SoundCue, number>();
  constructor(
    private settings: SoundSettings,
    private factory: () => AudioContext,
  ) {}
  unlock() {
    if (this.disposed || !this.visible || !this.settings.enabled || this.settings.volume === 0)
      return;
    this.unlocked = true;
    try {
      this.context ??= this.factory();
    } catch {
      /* Audio is optional on unsupported devices. */
    }
  }
  setSettings(settings: SoundSettings) {
    this.settings = readSoundSettings(JSON.stringify(settings));
    this.stop();
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) {
      this.stop();
      void this.context?.suspend().catch(() => {});
    }
  }
  private stop() {
    this.revision++;
    for (const [voice, gain] of this.voices) {
      try {
        voice.stop();
      } catch {
        /* A finished voice may already have stopped. */
      }
      voice.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }
  async play(cue: SoundCue): Promise<boolean> {
    const context = this.context;
    if (
      this.disposed ||
      !this.unlocked ||
      !context ||
      !this.visible ||
      !this.settings.enabled ||
      this.settings.volume === 0
    )
      return false;
    const revision = this.revision;
    const requested = Date.now();
    try {
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running' || this.revision !== revision || Date.now() - requested > 200)
        return false;
      if (
        requested - (this.lastPlayed.get(cue) ?? -Infinity) < 40 ||
        this.voices.size + cues[cue].length > 12
      )
        return false;
      this.lastPlayed.set(cue, requested);
      for (const tone of cues[cue]) {
        const start = context.currentTime + tone.at;
        const end = start + tone.duration;
        const voice = context.createOscillator();
        const gain = context.createGain();
        voice.type = tone.wave ?? 'sine';
        voice.frequency.setValueAtTime(tone.frequency, start);
        if (tone.to) voice.frequency.exponentialRampToValueAtTime(tone.to, end);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.settings.volume * 0.12, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        voice.connect(gain);
        gain.connect(context.destination);
        this.voices.set(voice, gain);
        voice.onended = () => {
          voice.disconnect();
          gain.disconnect();
          this.voices.delete(voice);
        };
        voice.start(start);
        voice.stop(end + 0.015);
      }
      return true;
    } catch {
      return false;
    }
  }
  dispose() {
    this.disposed = true;
    this.stop();
    void this.context?.close().catch(() => {});
  }
}

type GameState = {
  onGround: boolean;
  vy: number;
  collected: string[];
  removed: number;
  bridgeBuilt: boolean;
  won: boolean;
};
export function gameSound(previous: GameState, next: GameState): SoundCue | null {
  if (!previous.won && next.won) return 'victory';
  if (!previous.bridgeBuilt && next.bridgeBuilt) return 'bridge';
  if (next.removed > previous.removed) return 'remove';
  if (next.collected.length > previous.collected.length) return 'collect';
  if (previous.onGround && !next.onGround && next.vy < 0) return 'jump';
  return null;
}
