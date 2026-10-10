'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Music2, VolumeX } from 'lucide-react';
import { LocalizedText, useI18n } from './i18n';
import {
  defaultMusicSettings,
  MusicTransport,
  musicAllowed,
  musicSettingsKey,
  musicTracks,
  readMusicSettings,
  type MusicSnapshot,
  type MusicTrackId,
} from '@/lib/music';

const MusicContext = createContext<{
  state: MusicSnapshot;
  transport: MusicTransport | null;
  duck: (active: boolean) => void;
}>({
  state: { ...defaultMusicSettings, enabled: false, playing: false, error: '' },
  transport: null,
  duck: () => {},
});
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<MusicTransport | null>(null);
  const duck = useCallback((active: boolean) => controller.current?.setDucked(active), []);
  const [transport, setTransport] = useState<MusicTransport | null>(null);
  const [state, setState] = useState<MusicSnapshot>({
    ...defaultMusicSettings,
    enabled: false,
    playing: false,
    error: '',
  });
  useEffect(() => {
    const element = audio.current!;
    let settings = defaultMusicSettings;
    try {
      settings = readMusicSettings(localStorage.getItem(musicSettingsKey));
    } catch {
      /* Storage is optional. */
    }
    const player = new MusicTransport(element, settings, (next) => {
      setState(next);
      try {
        localStorage.setItem(
          musicSettingsKey,
          JSON.stringify({ trackId: next.trackId, volume: next.volume }),
        );
      } catch {
        /* Private browsing may disallow storage. */
      }
    });
    controller.current = player;
    setTransport(player);
    setState(player.snapshot());
    const visibility = () => void player.setVisible(document.visibilityState === 'visible');
    const failure = () => player.fail();
    element.addEventListener('error', failure);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('error', failure);
      player.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    void controller.current?.setAllowed(musicAllowed(pathname));
  }, [pathname, transport]);
  return (
    <MusicContext.Provider value={{ state, transport, duck }}>
      <audio ref={audio} preload="none" loop hidden data-background-music aria-hidden="true" />
      {children}
    </MusicContext.Provider>
  );
}
export function useMusicDucking(active: boolean) {
  const { duck } = useContext(MusicContext);
  useEffect(() => {
    duck(active);
    return () => duck(false);
  }, [active, duck]);
}
export function MusicControls() {
  const { state, transport } = useContext(MusicContext);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="music-controls" ref={wrap}>
      <div className="music-pill" data-playing={state.playing}>
        <button
          type="button"
          className="music-toggle"
          aria-label={t(state.enabled ? 'Pause music' : 'Play music')}
          aria-pressed={state.enabled}
          disabled={!transport}
          onClick={() => void transport?.toggle()}
        >
          {state.enabled ? <Music2 size={18} /> : <VolumeX size={18} />}
          <span className="music-label">
            <LocalizedText text="Music" />
          </span>
        </button>
        <button
          type="button"
          ref={trigger}
          className="music-settings"
          aria-label={t('Music settings')}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div id={id} className="music-popover" role="dialog" aria-label={t('Music settings')}>
          <strong>
            <Music2 size={18} />
            <LocalizedText text="Soft instrumental music" />
          </strong>
          <label>
            <LocalizedText text="Music track" />
            <select
              aria-label={t('Music track')}
              value={state.trackId}
              onChange={(event) => void transport?.setTrack(event.target.value as MusicTrackId)}
            >
              {musicTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {t(track.title)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="music-volume-label">
              <LocalizedText text="Music volume" />
              <output>{Math.round(state.volume * 100)}%</output>
            </span>
            <input
              type="range"
              aria-label={t('Music volume')}
              min="0"
              max="100"
              step="1"
              value={Math.round(state.volume * 100)}
              onChange={(event) => transport?.setVolume(Number(event.target.value) / 100)}
            />
          </label>
          <p>
            <LocalizedText text="A gentle tune for your adventure." />
          </p>
        </div>
      )}
      {state.error && (
        <span className="music-error" role="alert">
          <LocalizedText text={state.error} />
        </span>
      )}
    </div>
  );
}
