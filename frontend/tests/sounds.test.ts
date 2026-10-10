import { describe, expect, it, vi } from 'vitest';
import { gameSound, readSoundSettings, SoundTransport } from '../src/lib/sounds';

function audio() {
  const nodes: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const gains: number[] = [];
  const context = {
    state: 'running',
    currentTime: 1,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
    createOscillator: vi.fn(() => {
      const node = {
        type: '',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      nodes.push(node);
      return node;
    }),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((value: number) => gains.push(value)),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { context, factory, nodes, gains };
}

describe('child-friendly sound transport', () => {
  it('requires a gesture, then schedules short enveloped tones with bounded volume', async () => {
    const fake = audio();
    const player = new SoundTransport({ enabled: true, volume: 0.3 }, fake.factory);
    expect(await player.play('button')).toBe(false);
    expect(fake.factory).not.toHaveBeenCalled();
    player.unlock();
    expect(await player.play('button')).toBe(true);
    expect(fake.nodes[0].start).toHaveBeenCalled();
    expect(fake.nodes[0].stop.mock.calls[0][0]).toBeLessThan(1.3);
    expect(fake.gains[0]).toBeGreaterThan(0);
    expect(fake.gains[0]).toBeLessThan(0.05);
  });
  it('mute and zero volume silence active and future effects without altering music', async () => {
    const fake = audio();
    const player = new SoundTransport({ enabled: true, volume: 0.3 }, fake.factory);
    player.unlock();
    await player.play('victory');
    player.setSettings({ enabled: false, volume: 0.3 });
    expect(fake.nodes.every((node) => node.disconnect.mock.calls.length > 0)).toBe(true);
    expect(await player.play('navigation')).toBe(false);
    player.setSettings({ enabled: true, volume: 0 });
    expect(await player.play('correct')).toBe(false);
  });
  it('does not queue stale sounds while a suspended browser is resuming', async () => {
    const fake = audio();
    fake.context.state = 'suspended';
    let resume!: () => void;
    fake.context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume = () => {
            fake.context.state = 'running';
            resolve();
          };
        }),
    );
    const player = new SoundTransport({ enabled: true, volume: 0.3 }, fake.factory);
    player.unlock();
    const pending = player.play('collect');
    player.setVisible(false);
    resume();
    expect(await pending).toBe(false);
    expect(fake.nodes).toHaveLength(0);
    player.setVisible(true);
    expect(await player.play('jump')).toBe(true);
    player.dispose();
    expect(fake.context.close).toHaveBeenCalledOnce();
    expect(await player.play('button')).toBe(false);
  });
  it('bounds rapid effects and tolerates unavailable or denied browser audio', async () => {
    const fake = audio();
    const player = new SoundTransport({ enabled: true, volume: 0.3 }, fake.factory);
    player.unlock();
    await player.play('collect');
    await player.play('collect');
    expect(fake.context.createOscillator.mock.calls.length).toBeLessThanOrEqual(3);
    const unavailable = new SoundTransport({ enabled: true, volume: 0.3 }, () => {
      throw new Error('unsupported');
    });
    unavailable.unlock();
    expect(await unavailable.play('button')).toBe(false);
    fake.context.state = 'suspended';
    fake.context.resume.mockRejectedValue(new Error('denied'));
    expect(await player.play('jump')).toBe(false);
  });
  it('validates stored settings and clamps volume', () => {
    expect(readSoundSettings('broken')).toEqual({ enabled: true, volume: 0.3 });
    expect(readSoundSettings('{"enabled":false,"volume":0.12}')).toEqual({
      enabled: false,
      volume: 0.12,
    });
    expect(readSoundSettings('{"enabled":"false","volume":20}')).toEqual({
      enabled: true,
      volume: 1,
    });
    expect(readSoundSettings('{"volume":null}').volume).toBe(0.3);
  });
});

describe('game sounds follow actual state transitions', () => {
  const state = {
    onGround: true,
    vy: 0,
    collected: [] as string[],
    removed: 0,
    bridgeBuilt: false,
    won: false,
  };
  it('plays once on takeoff, collection, removal, bridge and victory', () => {
    expect(gameSound(state, { ...state, onGround: false, vy: -200 })).toBe('jump');
    const airborne = { ...state, onGround: false, vy: -200 };
    expect(gameSound(airborne, { ...airborne, vy: -180 })).toBe(null);
    expect(gameSound(state, { ...state, collected: ['one'] })).toBe('collect');
    expect(gameSound(state, { ...state, removed: 1 })).toBe('remove');
    expect(gameSound(state, { ...state, bridgeBuilt: true })).toBe('bridge');
    expect(gameSound(state, { ...state, won: true })).toBe('victory');
  });
  it('is silent during movement, landing, resets and unchanged state', () => {
    expect(gameSound(state, state)).toBe(null);
    expect(gameSound({ ...state, collected: ['one'], won: true }, state)).toBe(null);
    expect(gameSound({ ...state, onGround: false, vy: 200 }, state)).toBe(null);
  });
});
