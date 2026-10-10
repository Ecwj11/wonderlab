'use client';
import { useSounds } from '../sounds';
import { gameSound } from '@/lib/sounds';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Coins,
  Flag,
  Leaf,
  Lightbulb,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import {
  buildForestBridge,
  createForestLevel,
  createForestState,
  FOREST_PLAYER,
  forestCamera,
  stepForest,
  takeForestBlock,
} from '@/lib/forest-game';
import { LocalizedText, useI18n } from '../i18n';
import type { SceneProps } from './types';

type NumberScene = Extract<PublicScene, { type: 'NUMBER_GAME' }>;
type ForestState = ReturnType<typeof createForestState>;
type Stage = 'START' | 'PLAY' | 'WON';
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

function Cube({
  x,
  y,
  color,
  faded = false,
  value,
}: {
  x: number;
  y: number;
  color: 'blue' | 'gold';
  faded?: boolean;
  value?: number;
}) {
  const palette =
    color === 'blue' ? ['#31c5ff', '#0876e9', '#b5f3ff'] : ['#ffe63d', '#f6a300', '#fff3a6'];
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.18 : 1}>
      <ellipse cx="17" cy="38" rx="23" ry="5" fill="#153923" opacity=".25" />
      <path d="M0 1 13 -6 40 0 28 8Z" fill={palette[0]} stroke={palette[2]} strokeWidth="2" />
      <path d="M0 1 28 8 28 38 0 30Z" fill={palette[1]} stroke={palette[2]} strokeWidth="2" />
      <path d="M28 8 40 0 40 30 28 38Z" fill={palette[0]} stroke={palette[2]} strokeWidth="2" />
      <path d="M4 5 23 10" stroke="white" strokeWidth="2" opacity=".55" />
      {value !== undefined && (
        <g>
          <rect
            x="-15"
            y="-32"
            width="70"
            height="27"
            rx="7"
            fill="#fff8dd"
            stroke={palette[1]}
            strokeWidth="2"
          />
          <text x="20" y="-13" textAnchor="middle" fill="#194c43" fontSize="19" fontWeight="900">
            {value}
          </text>
        </g>
      )}
    </g>
  );
}

export function ForestScene({
  scene,
  onChange,
  playing,
  lessonVersion,
  onPlayingChange,
}: SceneProps<NumberScene>) {
  const { t } = useI18n();
  const { play } = useSounds();
  const [stage, setStage] = useState<Stage>('START');
  const [index, setIndex] = useState(0);
  const [state, setState] = useState(createForestState);
  const stateRef = useRef(state);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [answers, setAnswers] = useState<{ roundId: string; value: number }[]>([]);
  const [viewWidth, setViewWidth] = useState(1140);
  const [camera, setCamera] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<Control>());
  const pointers = useRef(new Map<number, Control>());
  const round = scene.rounds[index];
  const level = useMemo(() => createForestLevel(round), [round]);
  const active = playing && !paused && !hint && stage === 'PLAY' && !state.won;
  const valueMode = round.blockMode === 'VALUES';
  const subtraction = round.operation === 'SUBTRACT' && !valueMode;
  const operator = { ADD: '+', SUBTRACT: '−', MULTIPLY: '×', DIVIDE: '÷' }[round.operation];
  const blueCollected = level.blocks
    .filter((block) => block.color === 'blue' && state.collected.includes(block.id))
    .reduce((sum, block) => sum + block.value, 0);
  const goldCollected = level.blocks
    .filter((block) => block.color === 'gold' && state.collected.includes(block.id))
    .reduce((sum, block) => sum + block.value, 0);
  const allCollected = state.collected.length === level.blocks.length;
  const ready = allCollected && (!subtraction || state.removed === round.right);
  const coins = answers.length * 20;
  const walking = state.onGround && state.moving;
  // Essential movement feedback: reduced motion disables decorative effects, not footsteps.
  const walkFrame = walking ? Math.floor(state.walkDistance / 32) % 4 : 1;
  const options = useMemo(() => {
    const values = new Set([level.target]);
    for (const delta of [1, -1, 2, -2]) {
      if (level.target + delta >= 0 && level.target + delta <= (valueMode ? 10000 : 20))
        values.add(level.target + delta);
      if (values.size === 3) break;
    }
    return [...values].sort((a, b) => a - b);
  }, [level.target, valueMode]);
  const clearInput = useCallback(() => {
    keys.current.clear();
    pointers.current.clear();
  }, []);
  const updateState = useCallback(
    (next: ForestState) => {
      const cue = gameSound(stateRef.current, next);
      if (cue) play(cue);
      stateRef.current = next;
      setState(next);
    },
    [play],
  );

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
      if (height > 0 && width > 0)
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
    const visibility = () => {
      if (document.hidden && stage === 'PLAY' && !stateRef.current.won) {
        clearInput();
        if (onPlayingChange) onPlayingChange(false);
        else setPaused(true);
      }
    };
    const blur = () => {
      clearInput();
      if (stage !== 'PLAY' || stateRef.current.won) return;
      if (onPlayingChange) onPlayingChange(false);
      else setPaused(true);
    };
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInput();
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [clearInput, onPlayingChange, stage]);
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
      const next = stepForest(
        stateRef.current,
        { direction: direction as -1 | 0 | 1, jump: held.has('jump') },
        seconds,
        level,
      );
      updateState(next);
      if (!next.won) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearInput();
    };
  }, [active, level, clearInput, updateState]);
  useEffect(() => {
    if (!state.won || stage !== 'PLAY') return;
    setAnswers((previous) =>
      previous.some((entry) => entry.roundId === round.id)
        ? previous
        : [...previous, { roundId: round.id, value: level.target }],
    );
    clearInput();
  }, [state.won, stage, round.id, level.target, clearInput]);
  useEffect(() => {
    onChange(
      stage === 'WON' && answers.length === scene.rounds.length ? { roundAnswers: answers } : null,
    );
  }, [stage, answers, scene.rounds.length, onChange]);
  useEffect(() => {
    setStage('START');
    setIndex(0);
    setAnswers([]);
    setPaused(false);
    setHint(false);
    setChoosing(false);
    setWrong(false);
    updateState(createForestState());
  }, [lessonVersion, scene.id, updateState]);

  useEffect(() => {
    if (stage !== 'PLAY' || state.won || !(hint || paused || !playing || choosing)) return;
    const frame = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>('[role="dialog"] button:not(:disabled)')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [stage, state.won, hint, paused, playing, choosing]);

  const togglePause = () => {
    clearInput();
    if (paused || !playing) {
      setPaused(false);
      onPlayingChange?.(true);
      rootRef.current?.focus({ preventScroll: true });
    } else if (onPlayingChange) onPlayingChange(false);
    else setPaused(true);
  };
  const focusWorld = () => rootRef.current?.focus({ preventScroll: true });
  const start = () => {
    if (!playing) return;
    setStage('PLAY');
    setPaused(false);
    focusWorld();
  };
  const replay = () => {
    if (!playing) return;
    setIndex(0);
    setAnswers([]);
    setChoosing(false);
    setWrong(false);
    setHint(false);
    setPaused(false);
    updateState(createForestState());
    setStage('PLAY');
    focusWorld();
  };
  const next = () => {
    if (!playing || !state.won) return;
    if (index === scene.rounds.length - 1) setStage('WON');
    else {
      setIndex(index + 1);
      updateState(createForestState());
      setChoosing(false);
      setWrong(false);
      setPaused(false);
      focusWorld();
    }
  };
  const choose = (value: number) => {
    if (!active || !ready) return;
    const nextState = buildForestBridge(stateRef.current, value, level);
    updateState(nextState);
    setWrong(!nextState.bridgeBuilt);
    if (!nextState.bridgeBuilt) play('incorrect');
    if (nextState.bridgeBuilt) {
      setChoosing(false);
      focusWorld();
    }
  };
  const fullscreen = async () => {
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
  const objective = state.bridgeBuilt
    ? 'Bridge ready! Walk to the treehouse.'
    : valueMode
      ? 'Collect the number blocks. Solve the calculation to build the bridge.'
      : subtraction && allCollected
        ? 'Take away the gold number. How many blocks are left?'
        : subtraction
          ? 'Walk and jump to collect the blue blocks.'
          : 'Walk and jump to collect the blue and gold blocks.';

  const inventory = (placement: string) => (
    <div className={`forest-inventory ${placement}`}>
      <div className="forest-inventory-heading">
        <LocalizedText text="Blocks" />
        <strong>
          {state.collected.length - state.removed}/{level.blocks.length - state.removed}
        </strong>
      </div>
      <div className="forest-inventory-slots">
        {level.blocks.map((block, i) => (
          <span
            key={block.id}
            className={
              'forest-slot ' +
              (valueMode ? 'value-slot ' : '') +
              (state.collected.includes(block.id) ? block.color : '') +
              (subtraction && i >= level.blocks.length - state.removed ? ' removed' : '')
            }
          >
            {state.collected.includes(block.id) ? (valueMode ? block.value : '◆') : ''}
          </span>
        ))}
      </div>
      {!state.bridgeBuilt &&
        (subtraction && allCollected && state.removed < round.right ? (
          <button
            type="button"
            className="forest-build-button"
            disabled={!active}
            onClick={() => {
              if (active) updateState(takeForestBlock(stateRef.current, level));
            }}
          >
            <LocalizedText text="Take away one block" />{' '}
            <span>
              {state.removed}/{round.right}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="forest-build-button"
            disabled={!active || !ready}
            onClick={() => {
              clearInput();
              setChoosing(true);
              setWrong(false);
            }}
          >
            <LocalizedText text={ready ? 'Build the bridge' : 'Collect all blocks'} />
            <ArrowRight size={15} />
          </button>
        ))}
      {state.bridgeBuilt && (
        <div className="forest-built-label">
          <Check size={16} />
          <LocalizedText text="Bridge built!" />
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="forest-game"
      tabIndex={0}
      aria-label={t('Number Forest game. Arrow keys to move, Space to jump.')}
      onKeyDown={(event) => {
        const modal = rootRef.current?.querySelector<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        );
        if (event.key === 'Tab' && modal) {
          const buttons = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
          return;
        }
        if (event.key === 'Escape' && stage === 'PLAY') {
          event.preventDefault();
          if (hint) {
            setHint(false);
            focusWorld();
          } else if (choosing) {
            setChoosing(false);
            focusWorld();
          } else togglePause();
          return;
        }
        if (
          (event.target as HTMLElement).closest(
            'button, input, textarea, select, [contenteditable="true"]',
          )
        )
          return;
        const control = keyControls[event.key];
        if (control && active) {
          event.preventDefault();
          keys.current.add(control);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) clearInput();
      }}
    >
      <header className="forest-hud">
        <div className="forest-name">
          <Leaf size={23} />
          <LocalizedText text="Number Forest" />
        </div>
        <div className="forest-level">
          <Flag size={15} />
          <LocalizedText text={`Level ${index + 1} of ${scene.rounds.length}`} />
        </div>
        <div className="forest-stats">
          <span aria-label={t('Completed missions')}>
            <Star size={20} fill="currentColor" />
            {answers.length}/{scene.rounds.length}
          </span>
          <span aria-label={t('Game coins collected')}>
            <Coins size={20} />
            {coins}
          </span>
        </div>
        <div className="forest-tools">
          <button
            type="button"
            onClick={() => {
              clearInput();
              setHint((value) => !value);
              if (hint) rootRef.current?.focus({ preventScroll: true });
            }}
            disabled={stage !== 'PLAY' || state.won}
            aria-label={t('Hint')}
            aria-pressed={hint}
          >
            <Lightbulb size={20} />
            <span>
              <LocalizedText text="Hint" />
            </span>
          </button>
          <button
            type="button"
            onClick={togglePause}
            aria-label={t(paused || !playing ? 'Resume' : 'Pause')}
            aria-pressed={paused || !playing}
          >
            {paused || !playing ? <Play size={20} /> : <Pause size={20} />}
            <span>
              <LocalizedText text={paused || !playing ? 'Resume' : 'Pause'} />
            </span>
          </button>
          <button
            type="button"
            disabled={stage !== 'PLAY' || !playing || state.won}
            onClick={() => {
              updateState(createForestState());
              setChoosing(false);
              setWrong(false);
              setPaused(false);
              clearInput();
              focusWorld();
            }}
            aria-label={t('Restart level')}
          >
            <RotateCcw size={18} />
          </button>
          <button type="button" onClick={() => void fullscreen()} aria-label={t('Fullscreen')}>
            <Maximize size={20} />
          </button>
        </div>
      </header>
      {stage === 'PLAY' && inventory('forest-top-inventory')}
      <div
        className="forest-world"
        ref={worldRef}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget || (event.target as Element).closest('svg'))
            focusWorld();
        }}
      >
        <svg
          className="forest-landscape"
          viewBox={`${camera} 0 ${viewWidth} 640`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="forest-water" x2="0" y2="1">
              <stop stopColor="#43cbea" />
              <stop offset="1" stopColor="#088ba8" />
            </linearGradient>
            <pattern id="forest-earth" width="47" height="49" patternUnits="userSpaceOnUse">
              <path d="m0 0 24 12 22-8-10 23-26 12Z" fill="#7c6249" />
              <path d="m22 20 24 12-18 17-16-14Z" fill="#9d8061" />
            </pattern>
          </defs>
          <image
            href="/games/number-forest/background.png"
            x="0"
            y="0"
            width="1600"
            height="640"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect x="0" y="568" width="1600" height="72" fill="url(#forest-water)" opacity=".32" />
          {[570, 920, 1010, 1080].map((x) => (
            <path
              key={x}
              d={`M${x} 596q24-8 50 0t45 0`}
              stroke="#c1f8ff"
              fill="none"
              strokeWidth="3"
              opacity=".5"
            />
          ))}
          <image
            href="/games/number-forest/treehouse.png"
            x="1280"
            y="226"
            width="300"
            height="312"
            preserveAspectRatio="xMidYMax meet"
          />
          {level.platforms.map((platform, i) => (
            <g key={i}>
              <rect
                x={platform.x}
                y={platform.y + 12}
                width={platform.width}
                height={platform.height}
                fill="url(#forest-earth)"
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
                d={`M${platform.x} ${platform.y + 5}h${platform.width}`}
                stroke="#96d63e"
                strokeWidth="10"
              />
              <path
                d={`M${platform.x} ${platform.y}h${platform.width}`}
                stroke="#d0ec7b"
                strokeWidth="3"
              />
            </g>
          ))}
          <g className={state.bridgeBuilt ? 'forest-bridge built' : 'forest-bridge'}>
            {[820, 1140].map((x) => (
              <g key={x}>
                <rect
                  x={x - 8}
                  y="487"
                  width="16"
                  height="76"
                  rx="4"
                  fill="#84502c"
                  stroke="#c48a46"
                  strokeWidth="3"
                />
                <circle cx={x} cy="496" r="3" fill="#ffe9ba" />
              </g>
            ))}
            <path d="M820 498Q975 543 1140 498" stroke="#e7b772" strokeWidth="5" fill="none" />
            {Array.from({ length: Math.max(5, Math.min(20, level.target)) }, (_, i) => {
              const w = 320 / Math.max(5, Math.min(20, level.target));
              return (
                <g key={i}>
                  <rect
                    x={820 + i * w + 2}
                    y="520"
                    width={w - 4}
                    height="26"
                    rx="3"
                    fill={state.bridgeBuilt ? '#ae713c' : '#775640'}
                    stroke={state.bridgeBuilt ? '#e3aa65' : '#e4caaa'}
                    strokeWidth="2"
                    strokeDasharray={state.bridgeBuilt ? undefined : '7 5'}
                    opacity={state.bridgeBuilt ? 1 : 0.56}
                  />
                  {state.bridgeBuilt && (
                    <path d={`M${825 + i * w} 535h${w - 13}`} stroke="#7d4b28" strokeWidth="2" />
                  )}
                </g>
              );
            })}
          </g>
          <g transform={`translate(${level.doorX - 12} 440)`}>
            <rect
              width="62"
              height="71"
              rx="13"
              fill={state.bridgeBuilt ? '#c4e84c' : '#f3b631'}
              stroke="#794419"
              strokeWidth="5"
            />
            <text x="31" y="49" textAnchor="middle" fontSize="36" fontWeight="900" fill="#633c1e">
              {state.bridgeBuilt ? '★' : '?'}
            </text>
          </g>
          {level.blocks
            .filter((block) => !state.collected.includes(block.id))
            .map((block) => (
              <Cube
                key={block.id}
                x={block.x - 20}
                y={block.y - 17}
                color={block.color}
                value={valueMode ? block.value : undefined}
              />
            ))}
          <ellipse
            cx={state.x + 24}
            cy={state.y + FOREST_PLAYER.height + 2}
            rx="23"
            ry="6"
            fill="#173f30"
            opacity={state.onGround ? 0.25 : 0.1}
          />
          <g
            className="forest-mascot"
            data-gait={state.onGround ? (walking ? 'walk' : 'idle') : 'jump'}
            data-frame={walkFrame}
            transform={`translate(${state.x + 24} ${state.y + 32}) scale(${state.facing} 1)`}
          >
            {state.onGround ? (
              <svg
                className="forest-walk-sprite"
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
              x="1270"
              y="386"
              fill="#ffffd6"
              fontSize="26"
              fontWeight="900"
              stroke="#245734"
              strokeWidth="4"
              paintOrder="stroke"
            >
              →
            </text>
          )}
        </svg>
        <div className="forest-equation-board">
          <div
            className="forest-equation"
            aria-label={`${round.left} ${operator} ${round.right} = ${state.bridgeBuilt ? level.target : '?'}`}
          >
            <strong className="blue">{round.left}</strong>
            <span>{operator}</span>
            <strong className="gold">{round.right}</strong>
            <span>=</span>
            <strong className={state.bridgeBuilt ? 'solved' : 'unknown'}>
              {state.bridgeBuilt ? level.target : '?'}
            </strong>
          </div>
          <div className="forest-objective">
            <LocalizedText text={objective} />
          </div>
          <div className="forest-group-counts">
            <span>
              <i className="blue" />
              {blueCollected}/{round.left}
            </span>
            <span>{operator}</span>
            <span>
              <i className="gold" />
              {subtraction ? state.removed : goldCollected}/{round.right}
            </span>
          </div>
        </div>
        <div className="forest-waypoint">
          <Leaf size={15} />
          <LocalizedText text={state.bridgeBuilt ? 'To the treehouse' : 'Collect & build'} />{' '}
          <ArrowRight size={15} />
        </div>
        {stage === 'PLAY' && (
          <div className="forest-bottom">
            <div className="forest-move-controls">
              {(['left', 'right'] as const).map((control) => (
                <button
                  type="button"
                  key={control}
                  className="forest-control"
                  aria-label={t(control === 'left' ? 'Move left' : 'Move right')}
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
                  onKeyUp={() => keys.current.delete(control)}
                >
                  {control === 'left' ? <ArrowLeft /> : <ArrowRight />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="forest-control forest-jump"
              disabled={!active}
              aria-label={t('Jump')}
              data-sound="off"
              onPointerDown={(event) => hold(event, 'jump')}
              onPointerUp={releasePointer}
              onPointerCancel={releasePointer}
              onLostPointerCapture={releasePointer}
              onKeyDown={(event) => {
                if (active && (event.key === ' ' || event.key === 'Enter')) {
                  event.preventDefault();
                  keys.current.add('jump');
                }
              }}
              onKeyUp={() => keys.current.delete('jump')}
            >
              <ArrowUp />
              <span>
                <LocalizedText text="Jump" />
              </span>
            </button>
          </div>
        )}
        {stage === 'START' && (
          <div className="forest-overlay forest-welcome">
            <div className="forest-modal">
              <span className="forest-modal-leaf">
                <Leaf size={30} />
              </span>
              <h3>
                <LocalizedText text="An adventure in numbers" />
              </h3>
              <p>
                <LocalizedText text="Jump across the forest, collect number blocks and build a bridge to the treasure." />
              </p>
              <button type="button" className="forest-primary" disabled={!playing} onClick={start}>
                <Play size={20} fill="currentColor" />
                <LocalizedText text="Let’s play!" />
              </button>
              <div className="forest-start-keys">
                <kbd>←</kbd>
                <kbd>→</kbd>
                <LocalizedText text="Move" />
                <kbd>Space</kbd>
                <LocalizedText text="Jump" />
              </div>
            </div>
          </div>
        )}
        {stage === 'PLAY' && (hint || paused || !playing) && (
          <div className="forest-overlay">
            <div
              className="forest-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t(hint ? 'Forest hint' : 'Game paused')}
            >
              <button
                type="button"
                className="forest-modal-close"
                aria-label={t('Close dialog')}
                onClick={() => {
                  setHint(false);
                  setPaused(false);
                  if (!playing) onPlayingChange?.(true);
                  focusWorld();
                }}
              >
                <X size={19} />
              </button>
              {hint ? (
                <>
                  <Lightbulb size={34} className="forest-modal-icon" />
                  <h3>
                    <LocalizedText text="A little help for your adventure" />
                  </h3>
                  <p>
                    <LocalizedText text="Use the arrows or A and D to move. Press Space, W or the up arrow to jump. Walk into each block to collect it." />
                  </p>
                  <p>
                    <LocalizedText
                      text={
                        valueMode
                          ? 'Each labelled block has a number value. Combine the blue values for the first number and the gold values for the second. Solve the calculation shown on the board to build your bridge.'
                          : subtraction
                            ? 'Collect the blue blocks. Take away the gold number, then choose how many remain to build your bridge.'
                            : 'Collect both groups. Add the blue and gold blocks together, then choose their total to build your bridge.'
                      }
                    />
                  </p>
                  <p>
                    <LocalizedText text="Cross the bridge and reach the treehouse to finish the level. If you fall, your blocks stay safe." />
                  </p>
                  <button
                    type="button"
                    className="forest-primary"
                    onClick={() => {
                      setHint(false);
                      focusWorld();
                    }}
                  >
                    <LocalizedText text="Got it. Let’s try." />
                  </button>
                </>
              ) : (
                <>
                  <Pause size={34} className="forest-modal-icon" />
                  <h3>
                    <LocalizedText text="Game paused" />
                  </h3>
                  <p>
                    <LocalizedText
                      text={
                        !playing
                          ? 'Game paused. Press Play to continue.'
                          : 'Your blocks are safe. Ready to explore?'
                      }
                    />
                  </p>
                  {(playing || onPlayingChange) && (
                    <button
                      type="button"
                      className="forest-primary"
                      onClick={() => {
                        setPaused(false);
                        onPlayingChange?.(true);
                        focusWorld();
                      }}
                    >
                      <Play size={18} />
                      <LocalizedText text="Resume" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {stage === 'PLAY' && choosing && !hint && !paused && playing && (
          <div className="forest-answer-panel" role="dialog" aria-label={t('Build the bridge')}>
            <button
              type="button"
              className="forest-modal-close"
              aria-label={t('Close dialog')}
              onClick={() => {
                setChoosing(false);
                focusWorld();
              }}
            >
              <X size={18} />
            </button>
            <p>
              <LocalizedText
                text={
                  valueMode
                    ? 'What is the answer to the calculation?'
                    : subtraction
                      ? 'How many blocks are left?'
                      : 'How many blocks altogether?'
                }
              />
            </p>
            <div className="forest-answer-options">
              {options.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => choose(value)}
                  aria-label={
                    valueMode ? `${t('Answer')}: ${value}` : t(`Build with ${value} blocks`)
                  }
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="forest-answer-feedback" role="status">
              {wrong && (
                <LocalizedText text="Count your blocks and try again. The bridge is still closed." />
              )}
            </div>
          </div>
        )}
        {stage === 'PLAY' && state.won && (
          <div className="forest-overlay">
            <div className="forest-modal forest-level-win" role="status">
              <Star size={56} fill="#ffd43e" className="forest-win-star" />
              <h3>
                <LocalizedText text="Treehouse reached!" />
              </h3>
              <p>
                <LocalizedText text={`Level ${index + 1} complete`} />
              </p>
              <div className="forest-earned">
                <Coins size={24} /> +20 <LocalizedText text="game coins" />
              </div>
              <button type="button" className="forest-primary" disabled={!playing} onClick={next}>
                <LocalizedText
                  text={index === scene.rounds.length - 1 ? 'Open the treasure' : 'Next level'}
                />
                <ArrowRight size={19} />
              </button>
            </div>
          </div>
        )}
        {stage === 'WON' && (
          <div className="forest-overlay">
            <div className="forest-modal forest-victory" role="status">
              <Trophy size={60} className="forest-win-star" />
              <h3>
                <LocalizedText text="The forest treasure is yours!" />
              </h3>
              <p>
                <LocalizedText text="You solved every number mission. Nicely done!" />
              </p>
              <div className="forest-earned">
                <Coins size={26} />
                {coins} <LocalizedText text="Game coins collected" />
              </div>
              <p className="forest-xp">
                <LocalizedText text="These coins are for this game. Finish the lesson to earn XP." />
              </p>
              <button type="button" className="forest-primary" disabled={!playing} onClick={replay}>
                <RotateCcw size={18} />
                <LocalizedText text="Play again" />
              </button>
            </div>
          </div>
        )}
      </div>
      <footer className="forest-footer">
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> / <kbd>A</kbd>
          <kbd>D</kbd>
          <LocalizedText text="Move" />
        </span>
        <span>
          <kbd>Space</kbd> / <kbd>↑</kbd>
          <LocalizedText text="Jump" />
        </span>
        <span>
          <LocalizedText text="Walk into blocks to collect them" />
        </span>
      </footer>
      <div className="sr-only" aria-live="polite">
        {state.collected.length > 0 && t(`${state.collected.length} blocks collected`)}{' '}
        {state.bridgeBuilt && t('Bridge ready! Walk to the treehouse.')}
      </div>
      {fullscreenError && (
        <div className="forest-fullscreen-message" role="status">
          <LocalizedText text="Fullscreen is unavailable in this browser." />
          <button
            type="button"
            aria-label={t('Close dialog')}
            onClick={() => setFullscreenError(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
