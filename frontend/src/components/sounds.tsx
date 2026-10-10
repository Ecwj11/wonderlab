'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  defaultSoundSettings,
  readSoundSettings,
  soundSettingsKey,
  SoundTransport,
  type SoundCue,
  type SoundSettings,
} from '@/lib/sounds';
import { LocalizedText, useI18n } from './i18n';

const SoundContext = createContext({
  settings: defaultSoundSettings,
  ready: false,
  setSettings: (_settings: SoundSettings) => {},
  play: (_cue: SoundCue) => {},
});
export const useSounds = () => useContext(SoundContext);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const transport = useRef<SoundTransport | null>(null);
  const [settings, updateSettings] = useState(defaultSoundSettings);
  const [ready, setReady] = useState(false);
  const play = useCallback((cue: SoundCue) => {
    void transport.current?.play(cue);
  }, []);
  const setSettings = useCallback((next: SoundSettings) => {
    transport.current?.setSettings(next);
    if (next.enabled) transport.current?.unlock();
    updateSettings(next);
    try {
      localStorage.setItem(soundSettingsKey, JSON.stringify(next));
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    let saved = defaultSoundSettings;
    try {
      saved = readSoundSettings(localStorage.getItem(soundSettingsKey));
    } catch {
      /* Storage is optional. */
    }
    const player = new SoundTransport(saved, () => new AudioContext());
    transport.current = player;
    updateSettings(saved);
    setReady(true);
    const unlock = (event: Event) => {
      if (event.isTrusted) player.unlock();
    };
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const control = event.target.closest(
        'button, a[href], [role="button"], [role="menuitem"], select, summary',
      );
      if (
        !control ||
        control.matches(':disabled, [aria-disabled="true"]') ||
        control.closest('[inert], [data-sound="off"]')
      )
        return;
      player.unlock();
      const cue =
        control.closest('nav, [role="navigation"]') || control.matches('a[href]')
          ? 'navigation'
          : control.hasAttribute('aria-expanded') ||
              control.getAttribute('aria-haspopup') === 'menu' ||
              control.matches('select, [role="menuitem"]') ||
              control.tagName === 'SUMMARY'
            ? 'menu'
            : 'button';
      void player.play(cue);
    };
    const visibility = () => player.setVisible(!document.hidden);
    const storage = (event: StorageEvent) => {
      if (event.key !== soundSettingsKey) return;
      const next = readSoundSettings(event.newValue);
      player.setSettings(next);
      updateSettings(next);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', click, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('storage', storage);
    visibility();
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('storage', storage);
      player.dispose();
      transport.current = null;
    };
  }, []);
  return (
    <SoundContext.Provider value={{ settings, ready, setSettings, play }}>
      {children}
    </SoundContext.Provider>
  );
}

export function SoundControls() {
  const { settings, ready, setSettings, play } = useSounds();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
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
    <div className="music-controls sound-controls" ref={wrap}>
      <div className="music-pill" data-playing={settings.enabled && settings.volume > 0}>
        <button
          ref={trigger}
          type="button"
          className="sound-trigger"
          disabled={!ready}
          aria-label={t('Sound settings')}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {settings.enabled && settings.volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="music-label">
            <LocalizedText text="Sound" />
          </span>
        </button>
      </div>
      {open && (
        <div className="music-popover" id={id} role="dialog" aria-label={t('Sound settings')}>
          <strong>
            <Volume2 size={18} />
            <LocalizedText text="Playful sound effects" />
          </strong>
          <button
            className="sound-switch"
            type="button"
            data-sound="off"
            aria-pressed={settings.enabled}
            onClick={() => {
              setSettings({ ...settings, enabled: !settings.enabled });
              if (!settings.enabled) play('button');
            }}
          >
            {settings.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <LocalizedText text={settings.enabled ? 'Sound effects on' : 'Sound effects off'} />
          </button>
          <label>
            <span className="music-volume-label">
              <LocalizedText text="Sound volume" />
              <output>{Math.round(settings.volume * 100)}%</output>
            </span>
            <input
              aria-label={t('Sound volume')}
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(settings.volume * 100)}
              onChange={(event) =>
                setSettings({ ...settings, volume: Number(event.target.value) / 100 })
              }
            />
          </label>
          <button
            type="button"
            className="sound-preview"
            data-sound="off"
            disabled={!settings.enabled || settings.volume === 0}
            onClick={() => play('collect')}
          >
            <LocalizedText text="Try a sound" />
          </button>
          <p>
            <LocalizedText text="Buttons, menus and games. Music has its own volume." />
          </p>
        </div>
      )}
    </div>
  );
}
