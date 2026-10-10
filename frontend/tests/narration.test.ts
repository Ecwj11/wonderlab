import { describe, expect, it, vi } from 'vitest';
import { NarrationTransport } from '../src/lib/narration';

function port() {
  const events = new EventTarget();
  const audio = {
    src: '',
    currentTime: 0,
    volume: 1,
    playbackRate: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return { audio, events };
}
describe('story narration', () => {
  it('invalidates the previous ended state before a buffered replay or settings update', async () => {
    const { audio, events } = port();
    const player = new NarrationTransport(audio, () => {});
    player.load('/audio/stories/garden/welcome.mp3');
    await player.play();
    events.dispatchEvent(new Event('ended'));
    let finish!: () => void;
    audio.play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const replay = player.replay();
    player.setVolume(0.4);
    player.setRate(0.8);
    expect(player.snapshot().status).not.toBe('ended');
    finish();
    await replay;
    expect(player.snapshot().status).toBe('playing');
  });
  it('never starts before a request, reports the real ending and permits replay', async () => {
    const { audio, events } = port();
    const player = new NarrationTransport(audio, () => {});
    player.load('/audio/stories/garden/welcome.mp3');
    expect(audio.play).not.toHaveBeenCalled();
    await player.play();
    expect(player.snapshot().status).toBe('playing');
    events.dispatchEvent(new Event('ended'));
    expect(player.snapshot().status).toBe('ended');
    audio.currentTime = 12;
    await player.replay();
    expect(audio.currentTime).toBe(0);
    expect(player.snapshot().status).toBe('playing');
  });
  it('does not let an old play promise restart audio after pause, source change or disposal', async () => {
    const { audio } = port();
    let finish!: () => void;
    audio.play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const player = new NarrationTransport(audio, () => {});
    player.load('/audio/stories/garden/welcome.mp3');
    const pending = player.play();
    player.pause();
    finish();
    await pending;
    expect(player.snapshot().status).toBe('paused');
    expect(audio.pause).toHaveBeenCalled();
    player.load('/audio/stories/garden/seeds.mp3');
    expect(player.snapshot().status).toBe('idle');
    player.dispose();
    await player.play();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
  it('allows a failed source to retry, validates media paths and bounds voice settings', async () => {
    const { audio, events } = port();
    const player = new NarrationTransport(audio, () => {});
    expect(() => player.load('https://example.com/unsafe.mp3')).toThrow();
    player.load('/audio/stories/garden/seeds.mp3');
    events.dispatchEvent(new Event('error'));
    expect(player.snapshot().status).toBe('error');
    await player.play();
    expect(player.snapshot().status).toBe('playing');
    player.setVolume(2);
    expect(audio.volume).toBe(1);
    player.setVolume(-1);
    expect(audio.volume).toBe(0);
    player.setRate(8);
    expect(audio.playbackRate).toBe(1.25);
    player.dispose();
    events.dispatchEvent(new Event('ended'));
    expect(player.snapshot().status).not.toBe('ended');
  });
  it('does not pause a newer requested play when an older source promise resolves', async () => {
    const { audio } = port();
    const resolutions: (() => void)[] = [];
    audio.play.mockImplementation(() => new Promise<void>((resolve) => resolutions.push(resolve)));
    const player = new NarrationTransport(audio, () => {});
    player.load('/audio/stories/garden/welcome.mp3');
    const old = player.play();
    player.load('/audio/stories/garden/seeds.mp3');
    const current = player.play();
    const pauses = audio.pause.mock.calls.length;
    resolutions[0]();
    await old;
    expect(audio.pause).toHaveBeenCalledTimes(pauses);
    resolutions[1]();
    await current;
    expect(player.snapshot().status).toBe('playing');
  });
});
