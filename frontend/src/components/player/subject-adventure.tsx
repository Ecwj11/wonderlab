'use client';
import { useSounds } from '../sounds';
import { gameSound } from '@/lib/sounds';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PublicScene, Subject } from '@wonderlab/shared';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Compass,
  Calculator,
  Flag,
  FlaskConical,
  Heart,
  Lightbulb,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { FOREST_PLAYER, forestCamera } from '@/lib/forest-game';
import {
  adventureChoices,
  adventureResult,
  answerAdventureMission,
  createAdventureLevel,
  createAdventureState,
  stepAdventure,
  type AdventureState,
} from '@/lib/subject-adventure';
import { LocalizedText, useI18n } from '../i18n';
import type { SceneProps } from './types';

type MatchingScene = Extract<PublicScene, { type: 'MATCHING' }>;
type Control = 'left' | 'right' | 'jump';
const keyControls: Record<string, Control> = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'jump',
  w: 'jump',
  W: 'jump',
  ' ': 'jump',
};
const themes = {
  MATHEMATICS: {
    name: 'Maths Treasure Quest',
    asset: 'general',
    color: '#8a60c8',
    Icon: Calculator,
  },
  SCIENCE: { name: 'Garden Lab', asset: 'science', color: '#66a83e', Icon: FlaskConical },
  HISTORY: { name: 'Merdeka Quest', asset: 'history', color: '#d86744', Icon: Flag },
  GEOGRAPHY: { name: 'Malaysia Explorer', asset: 'geography', color: '#22a7c3', Icon: Compass },
  GENERAL: { name: 'Kindness Quest', asset: 'general', color: '#8a60c8', Icon: Heart },
};

function Landmark({ subject, unlocked }: { subject: Subject; unlocked: boolean }) {
  return (
    <g transform="translate(1290 258)" className="subject-adventure-landmark">
      <path
        d="M-15 235V85L105 0 225 85V235Z"
        fill={
          subject === 'SCIENCE'
            ? '#e0eea7'
            : subject === 'HISTORY'
              ? '#ffe8a8'
              : subject === 'GEOGRAPHY'
                ? '#b8e8e9'
                : '#e6d9f4'
        }
        stroke="#94633c"
        strokeWidth="8"
      />
      <path
        d="M-35 88 105 -12 245 88"
        fill="none"
        stroke="#94633c"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <rect
        x="72"
        y="175"
        width="70"
        height="86"
        rx="18"
        fill={unlocked ? '#b0d767' : '#f8c84c'}
        stroke="#94633c"
        strokeWidth="6"
      />
      <circle cx="125" cy="220" r="5" fill="#94633c" />
      {subject === 'SCIENCE' ? (
        <g stroke="#4a873b" strokeWidth="6">
          <path d="M105 150V65" />
          <ellipse cx="84" cy="94" rx="24" ry="12" transform="rotate(30 84 94)" fill="#80bf55" />
          <ellipse cx="126" cy="75" rx="24" ry="12" transform="rotate(-30 126 75)" fill="#80bf55" />
          <path d="M72 145h66l-8 20H80Z" fill="#dd8058" stroke="#94633c" />
        </g>
      ) : subject === 'HISTORY' ? (
        <g>
          <path d="M75 160V52" stroke="#94633c" strokeWidth="5" />
          <rect x="77" y="54" width="84" height="42" fill="#fff5dc" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x="77" y={54 + i * 6} width="84" height="3" fill="#db5b55" />
          ))}
          <rect x="77" y="54" width="42" height="24" fill="#304f91" />
          <circle cx="90" cy="66" r="8" fill="#f8c84c" />
          <circle cx="94" cy="64" r="7" fill="#304f91" />
          <polygon
            points={Array.from({ length: 28 }, (_, i) => {
              const angle = -Math.PI / 2 + (i * Math.PI) / 14;
              const radius = i % 2 ? 3 : 7;
              return `${109 + Math.cos(angle) * radius},${66 + Math.sin(angle) * radius}`;
            }).join(' ')}
            fill="#f8c84c"
          />
        </g>
      ) : subject === 'GEOGRAPHY' ? (
        <g>
          <circle cx="105" cy="108" r="45" fill="#fff7dc" stroke="#22a7c3" strokeWidth="6" />
          <path d="m105 70 14 38-14 38-14-38Z" fill="#d86744" />
          <path d="m105 108 14 0-14 38-14-38Z" fill="#22a7c3" />
          <circle cx="105" cy="108" r="6" fill="#f8c84c" />
        </g>
      ) : subject === 'MATHEMATICS' ? (
        <g>
          <rect
            x="67"
            y="67"
            width="76"
            height="90"
            rx="12"
            fill="#fff7dc"
            stroke="#94633c"
            strokeWidth="5"
          />
          <text x="105" y="105" textAnchor="middle" fill="#8a60c8" fontSize="30" fontWeight="900">
            + −
          </text>
          <text x="105" y="139" textAnchor="middle" fill="#8a60c8" fontSize="30" fontWeight="900">
            × ÷
          </text>
        </g>
      ) : (
        <g>
          <path d="M70 155V92l35-21 35 21v63Z" fill="#f8c84c" stroke="#94633c" strokeWidth="5" />
          <path d="M105 136c-31-20-23-39-10-28 10-17 34 1 10 28" fill="#cf637e" />
        </g>
      )}
      <text x="107" y="234" textAnchor="middle" fill="#194c43" fontSize="29" fontWeight="900">
        {unlocked ? '★' : '?'}
      </text>
    </g>
  );
}

export function SubjectAdventureScene({
  scene,
  subject = 'GENERAL',
  playing,
  onPlayingChange,
  onChange,
  lessonVersion,
}: SceneProps<MatchingScene>) {
  const { t } = useI18n();
  const { play } = useSounds();
  const theme = themes[subject];
  const Icon = theme.Icon;
  const dialogId = useId();
  const level = useMemo(() => createAdventureLevel(scene), [scene]);
  const [stage, setStage] = useState<'START' | 'PLAY' | 'WON'>('START');
  const [state, setState] = useState(createAdventureState);
  const stateRef = useRef(state);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(false);
  const [missionOpen, setMissionOpen] = useState(true);
  const [victoryOpen, setVictoryOpen] = useState(true);
  const [wrong, setWrong] = useState(false);
  const [notice, setNotice] = useState('');
  const [fullscreenError, setFullscreenError] = useState(false);
  const [viewWidth, setViewWidth] = useState(1600);
  const [camera, setCamera] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<Control>());
  const pointers = useRef(new Map<number, Control>());
  const emitted = useRef(false);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const mission = level.pairs.find((pair) => pair.id === state.missionId);
  const choices = useMemo(
    () => adventureChoices(state.missionId ?? '', level),
    [state.missionId, level],
  );
  const suspended = paused || !playing;
  const active = playing && !paused && !hint && !state.missionId && stage === 'PLAY' && !state.won;
  const walking = active && state.onGround && state.moving;
  const walkFrame = walking ? Math.floor(state.walkDistance / 32) % 4 : 1;
  const modal = suspended
    ? 'PAUSE'
    : hint
      ? 'HINT'
      : stage === 'START'
        ? 'START'
        : stage === 'WON'
          ? victoryOpen
            ? 'WON'
            : null
          : mission && missionOpen
            ? 'MISSION'
            : null;
  const updateState = useCallback(
    (next: AdventureState) => {
      const cue = gameSound(stateRef.current, next);
      if (cue) play(cue);
      stateRef.current = next;
      setState(next);
    },
    [play],
  );
  const clearInput = useCallback(() => {
    keys.current.clear();
    pointers.current.clear();
    const current = stateRef.current;
    if (current.jumpHeld || current.moving) {
      const next = { ...current, jumpHeld: false, moving: false };
      stateRef.current = next;
      setState(next);
    }
  }, []);
  const focusWorld = useCallback(() => rootRef.current?.focus({ preventScroll: true }), []);
  const resume = () => {
    setPaused(false);
    onPlayingChange?.(true);
    clearInput();
    focusWorld();
  };
  const togglePause = () => {
    if (suspended) resume();
    else {
      clearInput();
      setPaused(true);
      onPlayingChange?.(false);
    }
  };
  const reset = useCallback(() => {
    clearInput();
    updateState(createAdventureState());
    setCamera(0);
    setWrong(false);
    setNotice('');
    setHint(false);
    setPaused(false);
    setMissionOpen(true);
    setVictoryOpen(true);
    emitted.current = false;
    changeRef.current(null);
  }, [clearInput, updateState]);

  useEffect(() => {
    reset();
    setStage('START');
  }, [scene.id, lessonVersion, reset]);
  useEffect(() => {
    setCamera((previous) =>
      stage === 'START' ? 0 : forestCamera(previous, state.x, level.width, viewWidth),
    );
  }, [stage, state.x, level.width, viewWidth]);
  useEffect(() => {
    const element = worldRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setViewWidth(width >= 700 ? 1600 : Math.min(1600, (width / height) * 640));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const release = (event: KeyboardEvent) => {
      const control = keyControls[event.key];
      if (control) keys.current.delete(control);
    };
    const pauseAway = () => {
      clearInput();
      if (stage === 'PLAY' && !stateRef.current.won) {
        setPaused(true);
        onPlayingChange?.(false);
      }
    };
    const visibility = () => {
      if (document.hidden) pauseAway();
    };
    const fullscreenChanged = () => focusWorld();
    window.addEventListener('keyup', release);
    window.addEventListener('blur', pauseAway);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      clearInput();
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', pauseAway);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
    };
  }, [clearInput, stage, onPlayingChange, focusWorld]);
  useEffect(() => {
    if (!active) {
      clearInput();
      return;
    }
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      const seconds = previous ? Math.min((time - previous) / 1000, 1 / 30) : 0;
      previous = time;
      const held = new Set([...keys.current, ...pointers.current.values()]);
      const direction = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const next = stepAdventure(
        stateRef.current,
        { direction: direction as -1 | 0 | 1, jump: held.has('jump') },
        seconds,
        level,
      );
      updateState(next);
      if (next.missionId) {
        setMissionOpen(true);
        setWrong(false);
        setNotice('');
      }
      if (!next.won && !next.missionId) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearInput();
    };
  }, [active, level, updateState, clearInput]);
  useEffect(() => {
    if (!state.won) return;
    setStage('WON');
    clearInput();
    const result = adventureResult(state, level);
    if (result && !emitted.current) {
      emitted.current = true;
      changeRef.current(result);
    }
  }, [state.won, state, level, clearInput]);
  useEffect(() => {
    if (!modal) return;
    const frame = requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLButtonElement>('[role="dialog"] button:not(:disabled)')
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [modal, state.missionId]);

  const answer = (choiceId: string) => {
    if (suspended || hint || !mission || !missionOpen) return;
    const next = answerAdventureMission(stateRef.current, mission.id, choiceId, level);
    if (next === stateRef.current) {
      play('incorrect');
      setWrong(true);
      return;
    }
    play('correct');
    updateState(next);
    setWrong(false);
    setNotice('Mission solved!');
    focusWorld();
  };
  const fullscreen = async () => {
    clearInput();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else setFullscreenError(true);
    } catch {
      setFullscreenError(true);
    } finally {
      focusWorld();
    }
  };
  const hold = (event: React.PointerEvent<HTMLButtonElement>, control: Control) => {
    if (!active) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, control);
    focusWorld();
  };
  const releasePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointers.current.delete(event.pointerId);
  };
  const start = () => {
    resume();
    setStage('PLAY');
  };
  const replay = () => {
    reset();
    onPlayingChange?.(true);
    setStage('PLAY');
    focusWorld();
  };
  const close = () => {
    clearInput();
    setHint(false);
    setMissionOpen(false);
    if (stage === 'WON') setVictoryOpen(false);
    focusWorld();
  };

  return (
    <div
      ref={rootRef}
      className="subject-adventure-game"
      data-theme={theme.asset}
      data-stage={stage}
      tabIndex={0}
      aria-label={t('Subject adventure. Arrow keys to move, Space to jump.')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) clearInput();
      }}
      onKeyDown={(event) => {
        const dialog = rootRef.current?.querySelector<HTMLElement>('[role="dialog"]');
        if (event.key === 'Tab' && dialog) {
          const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (
            !dialog.contains(document.activeElement) ||
            (!event.shiftKey && document.activeElement === last)
          ) {
            event.preventDefault();
            first?.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          if (hint || modal === 'MISSION' || modal === 'WON') close();
          else togglePause();
          return;
        }
        if (
          (event.target as HTMLElement).closest(
            'button, input, textarea, select, [contenteditable="true"]',
          )
        )
          return;
        const control = keyControls[event.key];
        if (active && control) {
          event.preventDefault();
          keys.current.add(control);
        }
      }}
    >
      <header className="subject-adventure-hud">
        <div className="subject-adventure-name">
          <Icon size={25} />
          <LocalizedText text={theme.name} />
        </div>
        <div className="subject-adventure-score">
          <Star size={19} fill="currentColor" />
          <span aria-label={t('Missions solved')}>
            {state.matchedIds.length}/{level.pairs.length}
          </span>
        </div>
        <div className="subject-adventure-tools">
          <button
            type="button"
            disabled={stage !== 'PLAY' || state.won}
            aria-label={t('Hint')}
            aria-pressed={hint}
            onClick={() => {
              clearInput();
              setHint(!hint);
              if (hint) focusWorld();
            }}
          >
            <Lightbulb size={19} />
            <span>
              <LocalizedText text="Hint" />
            </span>
          </button>
          <button
            type="button"
            aria-label={t(suspended ? 'Resume' : 'Pause')}
            aria-pressed={suspended}
            onClick={togglePause}
          >
            {suspended ? <Play size={19} /> : <Pause size={19} />}
            <span>
              <LocalizedText text={suspended ? 'Resume' : 'Pause'} />
            </span>
          </button>
          <button type="button" aria-label={t('Restart adventure')} onClick={replay}>
            <RotateCcw size={19} />
          </button>
          <button type="button" aria-label={t('Fullscreen')} onClick={() => void fullscreen()}>
            <Maximize size={19} />
          </button>
        </div>
      </header>
      <div className="subject-adventure-mission-bar">
        <p>
          <LocalizedText
            text={
              state.bridgeBuilt
                ? 'All missions solved! Cross the bridge to the exit.'
                : 'Find a clue, then choose what it means.'
            }
          />
        </p>
        <div className="subject-adventure-progress" aria-label={t('Clues found')}>
          {level.pairs.map((pair, index) => (
            <span
              key={pair.id}
              data-solved={state.matchedIds.includes(pair.id)}
              data-found={state.collected.includes(level.blocks[index].id)}
              title={t(state.matchedIds.includes(pair.id) ? 'Mission solved!' : pair.left)}
            >
              {state.matchedIds.includes(pair.id) ? <Check size={15} /> : index + 1}
            </span>
          ))}
          {mission && !missionOpen && !suspended && (
            <button
              type="button"
              onClick={() => {
                setMissionOpen(true);
                setWrong(false);
              }}
            >
              <LocalizedText text="Continue mission" />
            </button>
          )}
        </div>
      </div>
      <div
        ref={worldRef}
        className="subject-adventure-world"
        onPointerDown={(event) => {
          if ((event.target as Element).closest('svg')) focusWorld();
        }}
      >
        <svg
          className="subject-adventure-landscape"
          viewBox={`${camera} 0 ${viewWidth} 640`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <image
            href={`/games/subject-adventure/${theme.asset}.png`}
            x="0"
            y="0"
            width="1600"
            height="640"
            preserveAspectRatio="xMidYMid slice"
          />
          <Landmark subject={subject} unlocked={state.bridgeBuilt} />
          {level.platforms.map((platform, index) => (
            <g key={index}>
              <rect
                x={platform.x}
                y={platform.y + 12}
                width={platform.width}
                height={platform.height}
                fill="#94633c"
              />
              <svg
                x={platform.x}
                y={platform.y - 5}
                width={platform.width}
                height={platform.height + 5}
                viewBox="17 205 2136 380"
                preserveAspectRatio="none"
                overflow="hidden"
              >
                <image href="/games/number-forest/platform.png" width="2172" height="724" />
              </svg>
              <path
                d={`M${platform.x} ${platform.y}h${platform.width}`}
                stroke="#b9dc74"
                strokeWidth="5"
              />
            </g>
          ))}
          <g
            className="subject-adventure-bridge"
            data-built={state.bridgeBuilt}
            opacity={state.bridgeBuilt ? 1 : 0.35}
          >
            <path d="M820 492Q980 540 1140 492" stroke="#e6be80" strokeWidth="5" fill="none" />
            {[820, 1140].map((x) => (
              <rect
                key={x}
                x={x - 8}
                y="486"
                width="16"
                height="72"
                rx="4"
                fill="#94633c"
                stroke="#ddb17d"
                strokeWidth="3"
              />
            ))}
            {Array.from({ length: 12 }, (_, index) => (
              <rect
                key={index}
                x={822 + (index * 320) / 12}
                y="520"
                width="23"
                height="25"
                rx="3"
                fill="#aa743f"
                stroke="#edc38e"
                strokeWidth="2"
                strokeDasharray={state.bridgeBuilt ? undefined : '4 4'}
              />
            ))}
          </g>
          {level.blocks
            .filter((block) => !state.collected.includes(block.id))
            .map((block) => {
              const index = level.blocks.indexOf(block);
              return (
                <g
                  className="subject-adventure-clue"
                  key={block.id}
                  transform={`translate(${block.x} ${block.y})`}
                >
                  <ellipse cy="21" rx="24" ry="5" fill="#194c43" opacity=".2" />
                  <circle r="23" fill="#fff4bd" stroke={theme.color} strokeWidth="5" />
                  <path d="m-14-10 14-5 14 5v22l-14-5-14 5Z" fill={theme.color} />
                  <path d="M0-13V7" stroke="#fff4bd" strokeWidth="2" />
                  <text y="5" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900">
                    {index + 1}
                  </text>
                </g>
              );
            })}
          <ellipse
            cx={state.x + 24}
            cy={state.y + FOREST_PLAYER.height + 2}
            rx="23"
            ry="6"
            fill="#194c43"
            opacity={state.onGround ? 0.25 : 0.1}
          />
          <g
            className="subject-adventure-mascot"
            data-gait={state.onGround ? (walking ? 'walk' : 'idle') : 'jump'}
            data-frame={walkFrame}
            transform={`translate(${state.x + 24} ${state.y + 32}) scale(${state.facing} 1)`}
          >
            {state.onGround ? (
              <svg
                x="-42"
                y="-58"
                width="84"
                height="92"
                viewBox={`${44 + (walkFrame % 2) * 627} ${24 + Math.floor(walkFrame / 2) * 627} 555 599`}
                preserveAspectRatio="xMidYMax meet"
                overflow="hidden"
              >
                <image href="/games/number-forest/explorer-walk.png" width="1254" height="1254" />
              </svg>
            ) : (
              <image
                href="/games/number-forest/explorer.png"
                x="-42"
                y="-58"
                width="84"
                height="92"
                preserveAspectRatio="xMidYMax meet"
              />
            )}
          </g>
          {state.bridgeBuilt && (
            <text
              x="1230"
              y="455"
              fontSize="48"
              fontWeight="900"
              fill="#fff7bf"
              stroke="#194c43"
              strokeWidth="4"
              paintOrder="stroke"
            >
              →
            </text>
          )}
        </svg>
        {modal && (
          <div className="subject-adventure-overlay">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogId}
              data-pair-id={modal === 'MISSION' ? mission?.id : undefined}
              className={`subject-adventure-modal ${modal === 'WON' ? 'subject-adventure-victory' : ''}`}
            >
              {(modal === 'MISSION' || modal === 'HINT') && (
                <button
                  type="button"
                  className="subject-adventure-close"
                  aria-label={t(modal === 'MISSION' ? 'Close mission' : 'Close')}
                  onClick={close}
                >
                  <X size={18} />
                </button>
              )}
              {modal === 'MISSION' && mission ? (
                <>
                  <div className="subject-adventure-modal-icon">
                    <Icon size={27} />
                  </div>
                  <p className="subject-adventure-eyebrow">
                    <LocalizedText
                      text={
                        subject === 'MATHEMATICS'
                          ? 'Solve the calculation to unlock this clue.'
                          : 'Choose the meaning of this clue.'
                      }
                    />
                  </p>
                  <h3 id={dialogId}>
                    <LocalizedText text={mission.left} />
                  </h3>
                  <div className="subject-adventure-choices">
                    {choices.map((choice) => (
                      <button
                        className="subject-adventure-choice"
                        type="button"
                        key={choice.id}
                        onClick={() => answer(choice.id)}
                      >
                        <LocalizedText text={choice.right} />
                      </button>
                    ))}
                  </div>
                  <p className="subject-adventure-feedback" role="status" aria-live="polite">
                    {wrong && (
                      <LocalizedText
                        text={
                          subject === 'MATHEMATICS'
                            ? 'Try another answer. You can do it!'
                            : 'Try another meaning. You can do it!'
                        }
                      />
                    )}
                  </p>
                </>
              ) : modal === 'PAUSE' ? (
                <>
                  <Pause className="subject-adventure-modal-icon" size={38} />
                  <h3 id={dialogId}>
                    <LocalizedText text="Adventure paused" />
                  </h3>
                  <button type="button" className="subject-adventure-primary" onClick={resume}>
                    <Play size={19} />
                    <LocalizedText text="Continue adventure" />
                  </button>
                </>
              ) : modal === 'HINT' ? (
                <>
                  <Lightbulb className="subject-adventure-modal-icon" size={38} />
                  <h3 id={dialogId}>
                    <LocalizedText text="Hint" />
                  </h3>
                  <p>
                    <LocalizedText
                      text={
                        state.bridgeBuilt
                          ? 'All missions solved! Cross the bridge to the exit.'
                          : 'Jump onto the raised paths to find every clue.'
                      }
                    />
                  </p>
                  <button type="button" className="subject-adventure-primary" onClick={close}>
                    <LocalizedText text="Continue adventure" />
                  </button>
                </>
              ) : modal === 'WON' ? (
                <>
                  <Trophy className="subject-adventure-modal-icon" size={48} />
                  <h3 id={dialogId}>
                    <LocalizedText text="Adventure complete!" />
                  </h3>
                  <p>
                    <LocalizedText text="You found every clue and reached the exit." />
                  </p>
                  <div className="subject-adventure-earned">
                    <Star size={24} fill="currentColor" />
                    {state.matchedIds.length}/{level.pairs.length}
                  </div>
                  <button type="button" className="subject-adventure-primary" onClick={close}>
                    <ArrowRight size={19} />
                    <LocalizedText text="Continue learning" />
                  </button>
                  <button type="button" className="subject-adventure-replay" onClick={replay}>
                    <RotateCcw size={16} />
                    <LocalizedText text="Play again" />
                  </button>
                </>
              ) : (
                <>
                  <div className="subject-adventure-modal-icon">
                    <Icon size={37} />
                  </div>
                  <h3 id={dialogId}>
                    <LocalizedText text={theme.name} />
                  </h3>
                  <p>
                    <LocalizedText text="Walk and jump to collect clues. Solve every mission to build the bridge, then walk to the exit." />
                  </p>
                  <button type="button" className="subject-adventure-primary" onClick={start}>
                    <Play size={19} fill="currentColor" />
                    <LocalizedText text="Start adventure" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="subject-adventure-controls">
        <div className="subject-adventure-move-controls">
          {(['left', 'right', 'jump'] as const).map((control) => (
            <button
              className={`subject-adventure-control subject-adventure-${control}`}
              key={control}
              type="button"
              aria-label={t(
                control === 'left' ? 'Move left' : control === 'right' ? 'Move right' : 'Jump',
              )}
              disabled={!active}
              data-sound="off"
              onPointerDown={(event) => hold(event, control)}
              onPointerUp={releasePointer}
              onPointerCancel={releasePointer}
              onLostPointerCapture={releasePointer}
              onKeyDown={(event) => {
                if (active && (event.key === ' ' || event.key === 'Enter')) {
                  event.preventDefault();
                  keys.current.add(control);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') keys.current.delete(control);
              }}
              onBlur={() => keys.current.delete(control)}
            >
              {control === 'left' ? (
                <ArrowLeft size={30} />
              ) : control === 'right' ? (
                <ArrowRight size={30} />
              ) : (
                <ArrowUp size={30} />
              )}
              {control === 'jump' && (
                <span>
                  <LocalizedText text="Jump" />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="subject-adventure-keys">
          <LocalizedText text="Move with arrow keys or A and D. Jump with Space, W or the up arrow." />
        </p>
        <span className="subject-adventure-status" role="status" aria-live="polite">
          {notice && <LocalizedText text={notice} />}
        </span>
      </div>
      {fullscreenError && (
        <div className="subject-adventure-fullscreen-message" role="status">
          <LocalizedText text="Fullscreen is unavailable in this browser." />
          <button type="button" aria-label={t('Close')} onClick={() => setFullscreenError(false)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
