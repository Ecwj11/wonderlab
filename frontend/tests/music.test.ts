import { expect, it } from 'vitest';
import {
  MusicTransport,
  readMusicSettings,
  defaultMusicSettings,
  musicAllowed,
} from '../src/lib/music';
function sound() {
  let playing = false;
  const audio = {
    src: '',
    volume: 1,
    loop: false,
    currentTime: 0,
    play: async () => {
      playing = true;
    },
    pause: () => {
      playing = false;
    },
    load: () => {},
  };
  return { audio, isPlaying: () => playing };
}
it('starts quietly only after an explicit play action and keeps the same player when switching track', async () => {
  const { audio, isPlaying } = sound();
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  expect(isPlaying()).toBe(false);
  expect(audio.volume).toBeLessThanOrEqual(0.2);
  await transport.toggle();
  expect(isPlaying()).toBe(true);
  const first = audio.src;
  await transport.setTrack('little-explorer');
  expect(audio.src).not.toBe(first);
  expect(isPlaying()).toBe(true);
  await transport.toggle();
  expect(isPlaying()).toBe(false);
});
it('pauses in hidden tabs and resumes only if the listener still wants music', async () => {
  const { audio, isPlaying } = sound();
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  await transport.toggle();
  await transport.setVisible(false);
  expect(isPlaying()).toBe(false);
  expect(transport.snapshot().enabled).toBe(true);
  await transport.setVisible(true);
  expect(isPlaying()).toBe(true);
  await transport.toggle();
  await transport.setVisible(false);
  await transport.setVisible(true);
  expect(isPlaying()).toBe(false);
});
it('stops and clears playback intent when leaving the child site', async () => {
  const { audio, isPlaying } = sound();
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  await transport.toggle();
  await transport.setAllowed(false);
  expect(isPlaying()).toBe(false);
  await transport.setAllowed(true);
  expect(isPlaying()).toBe(false);
});
it('cannot restart after a pending play promise is overtaken by pause', async () => {
  const { audio, isPlaying } = sound();
  let finish!: () => void;
  audio.play = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  const pending = transport.toggle();
  await transport.toggle();
  finish();
  await pending;
  expect(transport.snapshot().playing).toBe(false);
  expect(transport.snapshot().enabled).toBe(false);
  expect(isPlaying()).toBe(false);
});
it('recovers from rejected playback without breaking later play actions', async () => {
  const { audio, isPlaying } = sound();
  const original = audio.play;
  audio.play = async () => {
    throw new Error('blocked');
  };
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  await transport.toggle();
  expect(transport.snapshot().error).not.toBe('');
  expect(transport.snapshot().enabled).toBe(false);
  audio.play = original;
  await transport.toggle();
  expect(transport.snapshot().error).toBe('');
  expect(isPlaying()).toBe(true);
});
it('rejects untrusted stored track URLs and invalid volumes', () => {
  expect(readMusicSettings('{broken')).toEqual(defaultMusicSettings);
  expect(
    readMusicSettings(
      JSON.stringify({ trackId: 'https://untrusted.example/track', volume: 'loud' }),
    ),
  ).toEqual(defaultMusicSettings);
  expect(readMusicSettings(JSON.stringify({ trackId: 'little-explorer', volume: 20 }))).toEqual({
    trackId: 'little-explorer',
    volume: 1,
  });
  expect(readMusicSettings(JSON.stringify({ trackId: 'curiosity-garden', volume: -1 }))).toEqual({
    trackId: 'curiosity-garden',
    volume: 0,
  });
});
it('limits music to child login and learning routes', () => {
  for (const path of ['/app', '/app/lesson/id', '/child/login'])
    expect(musicAllowed(path)).toBe(true);
  for (const path of [
    '/application',
    '/admin',
    '/admin/login',
    '/parent',
    '/parent/login',
    '/login',
  ])
    expect(musicAllowed(path)).toBe(false);
});

it('ducks background music for narration and restores the chosen volume without changing playback intent', async () => {
  const { audio, isPlaying } = sound();
  const transport = new MusicTransport(audio, defaultMusicSettings, () => {});
  await transport.setAllowed(true);
  await transport.toggle();
  transport.setDucked(true);
  expect(audio.volume).toBeCloseTo(0.18 * 0.2);
  expect(transport.snapshot().volume).toBe(0.18);
  transport.setVolume(0.3);
  expect(audio.volume).toBeCloseTo(0.3 * 0.2);
  transport.setDucked(false);
  expect(audio.volume).toBe(0.3);
  expect(isPlaying()).toBe(true);
});
