export const musicTracks = [
  { id: 'curiosity-garden', title: 'Curiosity Garden', src: '/audio/curiosity-garden.mp3' },
  { id: 'little-explorer', title: 'Little Explorer', src: '/audio/little-explorer.mp3' },
] as const;
export type MusicTrackId = (typeof musicTracks)[number]['id'];
export interface MusicSettings {
  trackId: MusicTrackId;
  volume: number;
}
export interface MusicSnapshot extends MusicSettings {
  enabled: boolean;
  playing: boolean;
  error: string;
}
export const defaultMusicSettings: MusicSettings = { trackId: 'curiosity-garden', volume: 0.18 };
export const musicSettingsKey = 'wl_music_settings_v1';
export function readMusicSettings(raw: string | null): MusicSettings {
  try {
    const value = JSON.parse(raw || 'null');
    return {
      trackId: musicTracks.some((track) => track.id === value?.trackId)
        ? value.trackId
        : defaultMusicSettings.trackId,
      volume:
        typeof value?.volume === 'number' && Number.isFinite(value.volume)
          ? Math.min(1, Math.max(0, value.volume))
          : defaultMusicSettings.volume,
    };
  } catch {
    return { ...defaultMusicSettings };
  }
}
export function musicAllowed(path: string) {
  return path === '/child/login' || path === '/app' || path.startsWith('/app/');
}
interface AudioPort {
  src: string;
  volume: number;
  loop: boolean;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}
export class MusicTransport {
  private allowed = false;
  private visible = true;
  private disposed = false;
  private ducked = false;
  private revision = 0;
  private state: MusicSnapshot;
  constructor(
    private audio: AudioPort,
    settings: MusicSettings,
    private onChange: (state: MusicSnapshot) => void,
  ) {
    this.state = { ...settings, enabled: false, playing: false, error: '' };
    audio.src = musicTracks.find((track) => track.id === settings.trackId)!.src;
    audio.volume = settings.volume;
    audio.loop = true;
  }
  snapshot() {
    return { ...this.state };
  }
  private publish() {
    if (!this.disposed) this.onChange(this.snapshot());
  }
  private wantsPlayback() {
    return !this.disposed && this.allowed && this.visible && this.state.enabled;
  }
  private async sync() {
    const revision = ++this.revision;
    if (!this.wantsPlayback()) {
      this.audio.pause();
      this.state.playing = false;
      this.publish();
      return;
    }
    this.publish();
    try {
      await this.audio.play();
      if (revision !== this.revision) {
        if (!this.wantsPlayback()) this.audio.pause();
        return;
      }
      this.state.playing = true;
      this.publish();
    } catch {
      if (revision === this.revision) this.fail();
    }
  }
  setAllowed(allowed: boolean) {
    this.allowed = allowed;
    if (!allowed) this.state.enabled = false;
    return this.sync();
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this.sync();
  }
  toggle() {
    if (this.disposed || !this.allowed) return Promise.resolve();
    const retry = !!this.state.error;
    this.state.enabled = !this.state.enabled;
    this.state.error = '';
    // Reload a failed source on an explicit retry; normal pauses retain the position.
    if (retry && this.state.enabled) this.audio.load();
    return this.sync();
  }
  setTrack(trackId: MusicTrackId) {
    const track = musicTracks.find((track) => track.id === trackId);
    if (!track || this.disposed || trackId === this.state.trackId) return Promise.resolve();
    this.audio.pause();
    this.state.trackId = trackId;
    this.state.playing = false;
    this.state.error = '';
    this.audio.src = track.src;
    this.audio.currentTime = 0;
    this.audio.load();
    return this.sync();
  }
  setVolume(volume: number) {
    if (!Number.isFinite(volume) || this.disposed) return;
    this.state.volume = Math.min(1, Math.max(0, volume));
    this.audio.volume = this.state.volume * (this.ducked ? 0.2 : 1);
    this.publish();
  }
  setDucked(ducked: boolean) {
    if (this.disposed) return;
    this.ducked = ducked;
    this.audio.volume = this.state.volume * (ducked ? 0.2 : 1);
  }
  fail() {
    ++this.revision;
    this.audio.pause();
    this.state.enabled = false;
    this.state.playing = false;
    this.state.error = 'Music couldn’t load. Please try again.';
    this.publish();
  }
  dispose() {
    this.disposed = true;
    ++this.revision;
    this.audio.pause();
  }
}
