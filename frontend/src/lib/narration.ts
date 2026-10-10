export type NarrationState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  volume: number;
  rate: number;
};
interface VoicePort {
  src: string;
  currentTime: number;
  volume: number;
  playbackRate: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}
export class NarrationTransport {
  private state: NarrationState = { status: 'idle', volume: 0.8, rate: 1 };
  private revision = 0;
  private disposed = false;
  private wanted = false;
  private source = '';
  private ended = () => {
    if (!this.disposed) {
      this.wanted = false;
      this.revision++;
      this.state.status = 'ended';
      this.publish();
    }
  };
  private failed = () => {
    if (!this.disposed) {
      this.wanted = false;
      this.revision++;
      this.audio.pause();
      this.state.status = 'error';
      this.publish();
    }
  };
  constructor(
    private audio: VoicePort,
    private changed: (state: NarrationState) => void,
  ) {
    audio.volume = this.state.volume;
    audio.playbackRate = this.state.rate;
    audio.addEventListener('ended', this.ended);
    audio.addEventListener('error', this.failed);
  }
  snapshot() {
    return { ...this.state };
  }
  private publish() {
    if (!this.disposed) this.changed(this.snapshot());
  }
  load(source: string) {
    if (!/^\/audio\/stories\/[a-z0-9-]+\/[a-z0-9-]+\.mp3$/.test(source))
      throw new Error('Invalid narration source');
    if (this.disposed) return;
    this.revision++;
    this.audio.pause();
    this.wanted = false;
    this.source = source;
    this.audio.src = source;
    this.audio.currentTime = 0;
    this.state.status = 'idle';
    this.publish();
  }
  async play() {
    if (this.disposed || !this.source) return;
    if (this.state.status === 'error') this.audio.load();
    if (this.state.status === 'ended') this.audio.currentTime = 0;
    this.wanted = true;
    const revision = ++this.revision;
    this.state.status = 'loading';
    this.publish();
    try {
      await this.audio.play();
      if (revision !== this.revision || this.disposed) {
        if (!this.wanted || this.disposed) this.audio.pause();
        return;
      }
      this.state.status = 'playing';
      this.publish();
    } catch {
      if (revision === this.revision && !this.disposed) this.failed();
    }
  }
  pause() {
    if (this.disposed) return;
    this.revision++;
    this.wanted = false;
    this.audio.pause();
    if (this.state.status !== 'ended' && this.state.status !== 'error')
      this.state.status = 'paused';
    this.publish();
  }
  replay() {
    if (!this.disposed) this.audio.currentTime = 0;
    return this.play();
  }
  setVolume(volume: number) {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.state.volume = this.audio.volume = Math.min(1, Math.max(0, volume));
    this.publish();
  }
  setRate(rate: number) {
    if (this.disposed || !Number.isFinite(rate)) return;
    this.state.rate = this.audio.playbackRate = Math.min(1.25, Math.max(0.8, rate));
    this.publish();
  }
  dispose() {
    this.disposed = true;
    this.wanted = false;
    this.revision++;
    this.audio.pause();
    this.audio.removeEventListener('ended', this.ended);
    this.audio.removeEventListener('error', this.failed);
  }
}
