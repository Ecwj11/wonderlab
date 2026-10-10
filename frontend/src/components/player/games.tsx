'use client';
import { useSounds } from '../sounds';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Coins,
  Flag,
  Gem,
  Hand,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import { LocalizedText, useI18n } from '../i18n';
import { Mascot } from '../art';
import type { SceneProps } from './types';

type NumberScene = Extract<PublicScene, { type: 'NUMBER_GAME' }>;
type MatchScene = Extract<PublicScene, { type: 'MATCHING' }>;
type GameStage = 'START' | 'PLAY' | 'WON';
function GamePaused({ playing }: { playing: boolean }) {
  return !playing ? (
    <div className="game-paused" role="status">
      <Play size={20} />
      <LocalizedText text="Game paused. Press Play to continue." />
    </div>
  ) : null;
}
function GameWelcome({
  scene,
  kind,
  start,
  playing,
}: {
  scene: NumberScene | MatchScene;
  kind: 'number' | 'matching';
  start: () => void;
  playing: boolean;
}) {
  return (
    <div className={'game-welcome ' + kind}>
      <div className="game-welcome-art">
        <span className="game-orbit-star one">✦</span>
        <Mascot />
        <span className="game-orbit-star two">✧</span>
        <div className="game-welcome-gem">
          <Gem size={32} />
        </div>
      </div>
      <span className="game-label">
        <Sparkles size={15} />
        <LocalizedText
          text={kind === 'number' ? 'Number treasure quest' : 'Memory match adventure'}
        />
      </span>
      <h3>{scene.title}</h3>
      <p>
        <LocalizedText
          text={
            kind === 'number'
              ? 'Build each number group with blocks. For subtraction, take away blocks from the first group. Choose the answer gate and finish every mission.'
              : 'Flip two cards. Match an idea with its meaning or total. Find every pair to win.'
          }
        />
      </p>
      <div className="game-rules">
        <span>
          <Hand size={18} />
          <LocalizedText text={kind === 'number' ? 'Build with blocks' : 'Flip two cards'} />
        </span>
        <span>
          <Gem size={18} />
          <LocalizedText
            text={kind === 'number' ? 'Choose the answer gate' : 'Find related ideas'}
          />
        </span>
        <span>
          <Trophy size={18} />
          <LocalizedText text="Collect game coins" />
        </span>
      </div>
      <button className="button primary game-start" disabled={!playing} onClick={start}>
        <Play size={18} fill="currentColor" />
        <LocalizedText text="Let’s play!" />
        <ArrowRight size={18} />
      </button>
      <GamePaused playing={playing} />
    </div>
  );
}
function GameVictory({
  coins,
  replay,
  playing,
  detail,
}: {
  coins: number;
  replay: () => void;
  playing: boolean;
  detail: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="game-victory" role="status">
      <div className="game-victory-art">
        <motion.div
          initial={reduced ? false : { scale: 0.6, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 170 }}
        >
          <Mascot />
        </motion.div>
        <span className="treasure-chest">
          <Trophy size={50} />
          <span>✦</span>
        </span>
      </div>
      <span className="game-label">
        <Flag size={16} />
        <LocalizedText text="Adventure won!" />
      </span>
      <h3>
        <LocalizedText text="Your treasure is a new skill." />
      </h3>
      <p>
        <LocalizedText text={detail} />
      </p>
      <div className="game-final-coins">
        <Coins size={26} />
        <strong>{coins}</strong>
        <LocalizedText text="Game coins collected" />
      </div>
      <p className="game-xp-note">
        <LocalizedText text="These coins are for this game. Finish the lesson to earn XP." />
      </p>
      <button className="button secondary" onClick={replay} disabled={!playing}>
        <RotateCcw size={16} />
        <LocalizedText text="Play again" />
      </button>
      <GamePaused playing={playing} />
    </div>
  );
}

export function NumberGameScene({ scene, onChange, playing }: SceneProps<NumberScene>) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const mascotControls = useAnimationControls();
  const [stage, setStage] = useState<GameStage>('START');
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [removed, setRemoved] = useState<number[]>([]);
  const [answers, setAnswers] = useState<{ roundId: string; value: number }[]>([]);
  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<'WRONG' | 'RIGHT' | null>(null);
  const round = scene.rounds[index];
  const subtraction = round.operation === 'SUBTRACT';
  const answer = subtraction ? round.left - round.right : round.left + round.right;
  const locked = !playing || feedback === 'RIGHT';
  const ready =
    left === round.left && (subtraction ? removed.length === round.right : right === round.right);
  const gates = useMemo(() => {
    const choices = new Set([answer]);
    for (const delta of [1, -1, 2, -2, 3]) {
      if (answer + delta >= 0 && answer + delta <= 20) choices.add(answer + delta);
      if (choices.size === 3) break;
    }
    return [...choices].sort((a, b) => a - b);
  }, [answer]);
  useEffect(() => {
    if (!playing) {
      mascotControls.stop();
      return;
    }
    void mascotControls.start({
      x: feedback === 'RIGHT' ? -165 + (gates.indexOf(answer) - 1) * 100 : 0,
      y: feedback === 'RIGHT' ? 220 : 0,
      rotate: feedback === 'RIGHT' ? 0 : 8,
      transition: { duration: reduced ? 0 : 0.65, ease: 'easeOut' },
    });
  }, [stage, feedback, playing, gates, answer, mascotControls, reduced]);
  useEffect(() => {
    onChange(
      stage === 'WON' && answers.length === scene.rounds.length ? { roundAnswers: answers } : null,
    );
  }, [stage, answers, scene.rounds.length, onChange]);
  const clearBoard = () => {
    setLeft(0);
    setRight(0);
    setRemoved([]);
    setFeedback(null);
  };
  const reset = () => {
    setStage('PLAY');
    setIndex(0);
    clearBoard();
    setAnswers([]);
    setCoins(0);
    setCombo(0);
  };
  const add = (side: 'left' | 'right') => {
    if (locked) return;
    setFeedback(null);
    if (side === 'left') setLeft((count) => Math.min(10, count + 1));
    else if (!subtraction) setRight((count) => Math.min(10, count + 1));
  };
  const removeBlock = (position: number) => {
    if (locked) return;
    setFeedback(null);
    if (subtraction && left === round.left)
      setRemoved((old) =>
        old.includes(position) ? old.filter((n) => n !== position) : [...old, position],
      );
    else {
      setLeft((count) => Math.max(0, count - 1));
      setRemoved([]);
    }
  };
  const drop = (side: 'left' | 'right', data: string) => {
    if (locked) return;
    if (data === 'wonderlab-block') add(side);
    else if (
      subtraction &&
      side === 'right' &&
      /^wonderlab-take:\d+$/.test(data) &&
      left === round.left
    ) {
      const position = Number(data.split(':')[1]);
      if (position >= 0 && position < left)
        setRemoved((old) => (old.includes(position) ? old : [...old, position]));
    }
  };
  const choose = (value: number) => {
    if (locked || !ready) return;
    if (value !== answer) {
      setFeedback('WRONG');
      setCombo(0);
      return;
    }
    setFeedback('RIGHT');
    setCombo((old) => old + 1);
    setCoins((old) => old + 10 + Math.min(combo, 4) * 5);
    setAnswers((old) => [
      ...old.filter((entry) => entry.roundId !== round.id),
      { roundId: round.id, value },
    ]);
  };
  const next = () => {
    if (!playing || feedback !== 'RIGHT') return;
    if (index + 1 === scene.rounds.length) setStage('WON');
    else {
      setIndex((old) => old + 1);
      clearBoard();
    }
  };
  if (stage === 'START')
    return (
      <GameWelcome scene={scene} kind="number" playing={playing} start={() => setStage('PLAY')} />
    );
  if (stage === 'WON')
    return (
      <GameVictory
        coins={coins}
        playing={playing}
        replay={reset}
        detail="You solved every number mission. Nicely done!"
      />
    );
  return (
    <div className="number-game game-stage">
      <div className="game-hud">
        <span className="game-label">
          <Flag size={16} />
          <LocalizedText text={`Mission ${index + 1} of ${scene.rounds.length}`} />
        </span>
        <div>
          <span className="game-coins">
            <Coins size={18} />
            {coins}
          </span>
          <span className="game-combo">
            <Sparkles size={16} />
            <LocalizedText text={`Combo ${combo}`} />
          </span>
        </div>
      </div>
      <div className="game-mission-map" aria-label={t('Number mission progress')}>
        {scene.rounds.map((mission, i) => (
          <span
            key={mission.id}
            className={
              i < index || (i === index && feedback === 'RIGHT')
                ? 'done'
                : i === index
                  ? 'current'
                  : ''
            }
          >
            {i < index || (i === index && feedback === 'RIGHT') ? <Check size={14} /> : i + 1}
          </span>
        ))}
      </div>
      <div className="number-quest-world">
        <span className="quest-cloud one" />
        <span className="quest-cloud two" />
        <div className="quest-hills" aria-hidden="true" />
        <motion.div className="quest-mascot" animate={mascotControls}>
          <Mascot />
          {feedback === 'RIGHT' && (
            <motion.span
              className="quest-unlocked-spark"
              initial={reduced ? false : { scale: 0 }}
              animate={{ scale: 1 }}
            >
              ✦
            </motion.span>
          )}
        </motion.div>
        <div className="number-equation">
          <strong>{round.left}</strong>
          <span>{subtraction ? '−' : '+'}</span>
          <strong>{round.right}</strong>
          <span>=</span>
          <strong className={feedback === 'RIGHT' ? 'solved' : 'unknown'}>
            {feedback === 'RIGHT' ? answer : '?'}
          </strong>
        </div>
        <p className="game-instruction">
          <LocalizedText
            text={
              subtraction
                ? 'Build the first group, then take away blocks.'
                : 'Build both groups, then choose an answer gate.'
            }
          />
        </p>
        <div className="number-crates">
          <section
            className="number-crate blue"
            onDragOver={(event) => {
              if (!locked) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop('left', event.dataTransfer.getData('text/plain'));
            }}
            aria-label={t('First number group')}
          >
            <div className="crate-heading">
              <LocalizedText text={subtraction ? 'Start with' : 'First group'} />
              <strong>
                {left}/{round.left}
              </strong>
            </div>
            <div className="crate-blocks">
              {Array.from({ length: left }, (_, position) => (
                <button
                  key={position}
                  type="button"
                  className={'number-block blue ' + (removed.includes(position) ? 'taken' : '')}
                  disabled={locked}
                  aria-label={t(
                    subtraction && left === round.left
                      ? `Take away block ${position + 1}`
                      : `Remove block ${position + 1}`,
                  )}
                  aria-pressed={subtraction ? removed.includes(position) : undefined}
                  onClick={() => removeBlock(position)}
                  draggable={
                    !locked && subtraction && left === round.left && !removed.includes(position)
                  }
                  onDragStart={(event) =>
                    event.dataTransfer.setData('text/plain', `wonderlab-take:${position}`)
                  }
                >
                  <Gem size={22} />
                </button>
              ))}
              {left === 0 && (
                <span className="crate-empty">
                  <LocalizedText text="Add blocks here" />
                </span>
              )}
            </div>
            <button
              className="crate-add"
              onClick={() => add('left')}
              disabled={locked || left === 10}
              aria-label={t('Add block to first group')}
            >
              + <LocalizedText text="Add block" />
            </button>
          </section>
          <span className="crate-operation">{subtraction ? '−' : '+'}</span>
          <section
            className={'number-crate ' + (subtraction ? 'peach' : 'pink')}
            onDragOver={(event) => {
              if (!locked) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop('right', event.dataTransfer.getData('text/plain'));
            }}
            aria-label={t(subtraction ? 'Take away group' : 'Second number group')}
          >
            <div className="crate-heading">
              <LocalizedText text={subtraction ? 'Take away' : 'Second group'} />
              <strong>
                {subtraction ? removed.length : right}/{round.right}
              </strong>
            </div>
            <div className="crate-blocks">
              {(subtraction ? removed : Array.from({ length: right }, (_, i) => i)).map(
                (position) => (
                  <motion.button
                    key={position}
                    initial={reduced ? false : { scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className={'number-block ' + (subtraction ? 'peach' : 'pink')}
                    disabled={locked}
                    aria-label={t(
                      subtraction
                        ? `Put back block ${position + 1}`
                        : `Remove block ${position + 1}`,
                    )}
                    onClick={() => {
                      setFeedback(null);
                      if (subtraction) setRemoved((old) => old.filter((n) => n !== position));
                      else setRight((old) => Math.max(0, old - 1));
                    }}
                  >
                    <Gem size={22} />
                  </motion.button>
                ),
              )}
              {(subtraction ? removed.length : right) === 0 && (
                <span className="crate-empty">
                  <LocalizedText
                    text={subtraction ? 'Click blocks to take them away' : 'Add blocks here'}
                  />
                </span>
              )}
            </div>
            {!subtraction && (
              <button
                className="crate-add"
                onClick={() => add('right')}
                disabled={locked || right === 10}
                aria-label={t('Add block to second group')}
              >
                + <LocalizedText text="Add block" />
              </button>
            )}
            {subtraction && (
              <span className="crate-remaining">
                <LocalizedText text={`${Math.max(0, left - removed.length)} blocks left`} />
              </span>
            )}
          </section>
        </div>
        <div className="block-bank">
          <span
            className="bank-block"
            draggable={!locked}
            onDragStart={(event) => event.dataTransfer.setData('text/plain', 'wonderlab-block')}
            aria-hidden="true"
          >
            <Gem size={22} />
          </span>
          <span>
            <LocalizedText text="Drag a block into a group, or use Add block." />
          </span>
          <button className="text-button" disabled={locked} onClick={clearBoard}>
            <RotateCcw size={14} />
            <LocalizedText text="Rebuild" />
          </button>
        </div>
        <div className="answer-gates" aria-label={t('Answer gates')}>
          {gates.map((value) => (
            <button
              key={value}
              className={
                'answer-gate ' + (feedback === 'RIGHT' && value === answer ? 'correct' : '')
              }
              disabled={locked || !ready}
              onClick={() => choose(value)}
              aria-label={t(`Answer gate ${value}`)}
            >
              <span>
                <LockKeyhole size={21} />
              </span>
              <strong>{value}</strong>
              <span className="gate-ground" />
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={feedback || (ready ? 'READY' : 'BUILD')}
          className={
            'game-feedback ' +
            (feedback === 'RIGHT' ? 'success' : feedback === 'WRONG' ? 'retry' : '')
          }
          role="status"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {feedback === 'RIGHT' ? (
            <>
              <Check size={20} />
              <LocalizedText text="Gate unlocked! Your coins are waiting." />
              <button className="button primary" disabled={!playing} onClick={next}>
                <LocalizedText
                  text={index + 1 === scene.rounds.length ? 'Open the treasure' : 'Next mission'}
                />
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <LocalizedText
                text={
                  feedback === 'WRONG'
                    ? 'That gate is locked. Count your blocks and try again.'
                    : ready
                      ? 'Your groups are ready. Choose the answer gate!'
                      : 'Match the numbers with your blocks to unlock the gates.'
                }
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <GamePaused playing={playing} />
    </div>
  );
}

type MemoryCard = { id: string; pairId: string; side: 'left' | 'right'; label: string };
function shuffledCards(scene: MatchScene, replay: number): MemoryCard[] {
  const cards = scene.pairs.flatMap((pair) => [
    { id: pair.id + ':left', pairId: pair.id, side: 'left' as const, label: pair.left },
    { id: pair.id + ':right', pairId: pair.id, side: 'right' as const, label: pair.right },
  ]);
  // A reproducible shuffle keeps SSR and hydration identical, with a new layout for replay.
  let seed = [...scene.id].reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    replay + 17,
  );
  for (let i = cards.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function MatchingGameScene({ scene, onChange, playing }: SceneProps<MatchScene>) {
  const { play } = useSounds();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<GameStage>('START');
  const [replay, setReplay] = useState(0);
  const cards = useMemo(() => shuffledCards(scene, replay), [scene, replay]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [coins, setCoins] = useState(0);
  const [message, setMessage] = useState('Flip two cards and find ideas that belong together.');
  const resolve = useCallback(() => {
    const first = cards.find((card) => card.id === flipped[0]),
      second = cards.find((card) => card.id === flipped[1]);
    if (!first || !second) return;
    if (first.pairId === second.pairId && first.side !== second.side) {
      setMatched((old) => (old.includes(first.pairId) ? old : [...old, first.pairId]));
      setCoins((old) => old + 20);
      play(matched.length + 1 === scene.pairs.length ? 'victory' : 'correct');
      setMessage('A perfect pair! Keep your memory sparkling.');
    } else {
      play('incorrect');
      setMessage('Those ideas belong to different pairs. Try another match!');
    }
    setFlipped([]);
  }, [cards, flipped, play, matched.length, scene.pairs.length]);
  useEffect(() => {
    if (flipped.length !== 2 || !playing) return;
    const timer = setTimeout(resolve, 900);
    return () => clearTimeout(timer);
  }, [flipped.length, playing, resolve]);
  useEffect(() => {
    if (matched.length === scene.pairs.length) setStage('WON');
  }, [matched.length, scene.pairs.length]);
  useEffect(() => {
    onChange(
      stage === 'WON' && matched.length === scene.pairs.length ? { matchedIds: matched } : null,
    );
  }, [stage, matched, scene.pairs.length, onChange]);
  const flip = (card: MemoryCard) => {
    if (
      !playing ||
      flipped.length === 2 ||
      matched.includes(card.pairId) ||
      flipped.includes(card.id)
    )
      return;
    setFlipped((old) => [...old, card.id]);
    if (flipped.length === 1) setMoves((old) => old + 1);
  };
  const reset = () => {
    setReplay((old) => old + 1);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setCoins(0);
    setMessage('Flip two cards and find ideas that belong together.');
    setStage('PLAY');
  };
  if (stage === 'START')
    return (
      <GameWelcome scene={scene} kind="matching" start={() => setStage('PLAY')} playing={playing} />
    );
  if (stage === 'WON')
    return (
      <GameVictory
        coins={coins}
        playing={playing}
        replay={reset}
        detail={`You found ${scene.pairs.length} pairs in ${moves} moves!`}
      />
    );
  return (
    <div className="matching-game game-stage">
      <div className="game-hud">
        <span className="game-label">
          <Gem size={16} />
          <LocalizedText text={`${matched.length} of ${scene.pairs.length} pairs found`} />
        </span>
        <div>
          <span className="game-coins">
            <Coins size={18} />
            {coins}
          </span>
          <span className="game-moves">
            <LocalizedText text={`${moves} moves`} />
          </span>
        </div>
      </div>
      <div className="memory-grid">
        {cards.map((card, index) => {
          const found = matched.includes(card.pairId),
            open = found || flipped.includes(card.id);
          return (
            <motion.button
              key={card.id}
              className={'memory-card ' + (open ? 'open ' : '') + (found ? 'matched' : '')}
              disabled={!playing || found || flipped.length === 2}
              aria-label={t(open ? `Card ${index + 1}: ${card.label}` : `Memory card ${index + 1}`)}
              aria-pressed={open}
              onClick={() => flip(card)}
              animate={{ rotateY: open ? 0 : 180 }}
              transition={{ duration: reduced ? 0 : 0.28 }}
            >
              <span
                className="memory-card-face"
                style={{ transform: open ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
              >
                {open ? (
                  <>
                    <span className="memory-card-mark">
                      {found ? <Check size={18} /> : <Sparkles size={16} />}
                    </span>
                    <strong>{card.label}</strong>
                    {found && (
                      <motion.span
                        className="memory-spark"
                        initial={reduced ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        ✦
                      </motion.span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="memory-card-pattern" aria-hidden="true">
                      ✦
                    </span>
                    <Gem size={36} />
                    <span className="memory-card-number">{String(index + 1).padStart(2, '0')}</span>
                  </>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
      <div className="game-feedback" role="status">
        <Sparkles size={18} />
        <LocalizedText text={message} />
      </div>
      <p className="memory-tip">
        <LocalizedText text="Remember the ideas. Match a concept with its meaning." />
      </p>
      <GamePaused playing={playing} />
    </div>
  );
}
