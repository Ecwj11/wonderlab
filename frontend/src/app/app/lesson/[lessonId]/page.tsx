'use client';
import { LocalizedText } from '@/components/i18n';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Pause,
  Play,
  Lightbulb,
  Check,
  Zap,
  Trophy,
  BookOpen,
  Target,
  Compass,
  Sparkles,
  LoaderCircle,
  Gamepad2,
} from 'lucide-react';
import {
  publicLessonSchema,
  subjectLabels,
  type LessonDetail,
  type QuizResult,
} from '@wonderlab/shared';
import { useApi, Loading, ErrorState, ProgressBar, Modal } from '@/components/ui';
import { interactionRegistry } from '@/components/player/registry';
import type { ActivityResult } from '@/components/player/types';
import { starsChanged } from '@/components/rewards-ui';
import { useSession } from '@/components/session';
import { api } from '@/lib/api';
import { Mascot } from '@/components/art';
function LearningNotes({ forest, children }: { forest: boolean; children: ReactNode }) {
  return forest ? (
    <details className="forest-learning-notes">
      <summary>
        <LocalizedText text="What you’re learning" />
      </summary>
      {children}
    </details>
  ) : (
    children
  );
}
export default function LessonPlayer() {
  const params = useParams<{ lessonId: string }>();
  const { data, error, loading, reload } = useApi<LessonDetail>('/lessons/' + params.lessonId);
  const { refresh } = useSession();
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [reset, setReset] = useState(0);
  const [hint, setHint] = useState(false);
  const [mode, setMode] = useState<'Learn' | 'Explore'>('Learn');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [earned, setEarned] = useState(0);
  const init = useRef('');
  const sceneStart = useRef(Date.now());
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!data?.definition || init.current === data.id) return;
    init.current = data.id;
    setCompleted(data.completedScenes);
    const restart = new URLSearchParams(window.location.search).has('restart');
    if (restart) setReset((old) => old + 1);
    const next = data.definition.scenes.findIndex((s) => !data.completedScenes.includes(s.id));
    setIndex(restart ? 0 : Math.max(0, next));
    setCelebrate(data.progressStatus === 'COMPLETED' && !restart);
  }, [data]);
  useEffect(() => {
    if (data?.status !== 'GENERATING') return;
    const timer = setTimeout(() => void reload(), 1500);
    return () => clearTimeout(timer);
  }, [data, reload]);
  useEffect(() => {
    sceneStart.current = Date.now();
    setResult(null);
    setSaveError('');
  }, [index]);
  const syncSvgPlayback = useCallback(() => {
    stageRef.current?.querySelectorAll('svg').forEach((svg) => {
      if (playing && !reducedMotion) svg.unpauseAnimations?.();
      else svg.pauseAnimations?.();
    });
  }, [playing, reducedMotion]);
  useEffect(syncSvgPlayback, [syncSvgPlayback, index, reset]);
  const quizComplete = useCallback(
    (quiz: QuizResult) => {
      if (data?.definition) {
        const scene = data.definition.scenes[index];
        setCompleted((old) => (old.includes(scene.id) ? old : [...old, scene.id]));
      }
      setEarned((old) => old + quiz.xpEarned);
      if (quiz.lessonCompleted) setCelebrate(true);
      starsChanged();
      void refresh();
    },
    [data, index, refresh],
  );
  if (loading && !data) return <Loading label="Opening your little adventure…" />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  if (data.status === 'GENERATING')
    return (
      <Loading label="Your adventure is being prepared. This page will open when it’s ready…" />
    );
  if (data.status === 'FAILED' || !data.definition)
    return (
      <ErrorState message="This lesson could not be generated. Create a new adventure to try again." />
    );
  const parsed = publicLessonSchema.safeParse(data.definition);
  if (!parsed.success)
    return (
      <ErrorState message="This lesson format could not be verified. Ask your teacher to regenerate it." />
    );
  const definition = parsed.data;
  const scene = definition.scenes[index];
  const isGame =
    scene.type === 'NUMBER_GAME' || scene.type === 'MATCHING' || scene.type === 'INTERACTIVE_STORY';
  const isAdventure =
    scene.type === 'MATCHING' &&
    (scene.gameStyle === 'ADVENTURE' ||
      (definition.subject !== 'MATHEMATICS' && scene.gameStyle !== 'MEMORY'));
  const isWorldGame =
    scene.type === 'NUMBER_GAME' || isAdventure || scene.type === 'INTERACTIVE_STORY';
  const activityInstructions =
    scene.type === 'NUMBER_GAME'
      ? 'Move and jump to collect the number blocks. Choose the correct answer to build the bridge, then reach the treehouse. Finish every level to win.'
      : isAdventure
        ? 'Walk and jump to collect clues. Solve every mission to build the bridge, then walk to the exit.'
        : scene.type === 'MATCHING'
          ? 'Flip two cards. Match an idea with its meaning or total. Find every pair to win.'
          : scene.instructions;
  const Renderer = interactionRegistry[scene.type];
  const ready = !!result || completed.includes(scene.id);
  const advance = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (!completed.includes(scene.id) && scene.type !== 'QUIZ') {
        const saved = await api<{ progress: number; lessonCompleted: boolean; xpEarned: number }>(
          `/lessons/${data.id}/progress`,
          {
            method: 'POST',
            body: JSON.stringify({
              lessonVersion: data.lessonVersion,
              sceneId: scene.id,
              result,
              elapsedSeconds: Math.min(600, Math.floor((Date.now() - sceneStart.current) / 1000)),
            }),
          },
        );
        setCompleted((old) => [...old, scene.id]);
        setEarned((old) => old + saved.xpEarned);
        if (saved.lessonCompleted) {
          setCelebrate(true);
          starsChanged();
          void refresh();
          return;
        }
      }
      if (index < definition.scenes.length - 1) setIndex(index + 1);
      else if (completed.length === definition.scenes.length) setCelebrate(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const practice = () => {
    setCelebrate(false);
    setIndex(0);
    setReset((old) => old + 1);
    setEarned(0);
    setResult(null);
  };
  if (celebrate)
    return (
      <div className="lesson-completion">
        <div className="completion-art">
          <Mascot />
          <span className="completion-star s1">✦</span>
          <span className="completion-star s2">✧</span>
          <span className="completion-star s3">✦</span>
        </div>
        <span className="subject-tag lavender">
          <Check size={13} />
          <LocalizedText text="Adventure completed" />
        </span>
        <h1>
          <LocalizedText text="Look at you, a little wiser." />
        </h1>
        <p>
          <LocalizedText text="You explored" /> <strong>{data.title}</strong>.<br />
          <LocalizedText text="That’s one more big idea that clicked." />
        </p>
        <div className="completion-rewards">
          <div>
            <Zap size={26} />
            <strong>{earned > 0 ? '+' + earned : '✓'}</strong>
            <span>
              <LocalizedText text={earned > 0 ? 'XP earned' : 'XP already earned'} />
            </span>
          </div>
          <div>
            <Trophy size={26} />
            <strong>1</strong>
            <span>
              <LocalizedText text="discovery completed" />
            </span>
          </div>
          <div>
            <Target size={26} />
            <strong>{definition.objectives.length}</strong>
            <span>
              <LocalizedText text="learning goals explored" />
            </span>
          </div>
        </div>
        <div className="completion-actions">
          <Link href="/app/library" className="button primary">
            <LocalizedText text="Discover another adventure" />
            <Sparkles size={17} />
          </Link>
          <button className="button secondary" onClick={practice}>
            <RotateCcw size={16} />
            <LocalizedText text="Practice again" />
          </button>
        </div>
        <Link href="/app" className="text-button">
          <ArrowLeft size={14} />
          <LocalizedText text="Back to my learning space" />
        </Link>
      </div>
    );
  return (
    <div className={'lesson-player ' + (isWorldGame ? 'forest-lesson' : '')}>
      <Link href="/app/lessons" className="text-button player-back">
        <ArrowLeft size={14} />
        <LocalizedText text="My lessons" />
      </Link>
      <div className="player-heading">
        <div>
          <span className="subject-tag lavender">
            <LocalizedText text={subjectLabels[data.subject]} />
            <span>·</span>
            <LocalizedText text={data.language} />
          </span>
          <h1>{data.title}</h1>
        </div>
        <div className="player-xp">
          <Zap size={18} />
          <span>
            <LocalizedText text="Every discovery counts" />
          </span>
        </div>
      </div>
      <div className="player-progress">
        <ProgressBar value={(completed.length / definition.scenes.length) * 100} />
        <span>
          {completed.length} / {definition.scenes.length}
          <LocalizedText text="activities" />
        </span>
      </div>
      <div className="player-scene-nav">
        {definition.scenes.map((s, i) => (
          <button
            key={s.id}
            className={
              (i === index ? 'active ' : '') + (completed.includes(s.id) ? 'completed' : '')
            }
            onClick={() => setIndex(i)}
          >
            <span>{completed.includes(s.id) ? <Check size={12} /> : i + 1}</span>
            <strong>{s.title}</strong>
          </button>
        ))}
      </div>
      <div className="player-layout">
        <section className="player-main">
          <div className="stage-toolbar">
            <span>
              <Sparkles size={14} />
              <LocalizedText
                text={
                  scene.type === 'QUIZ'
                    ? 'Quiz time'
                    : scene.type === 'FRACTION_PIZZA'
                      ? 'A slice of discovery'
                      : scene.title
                }
              />
            </span>
            <div className="player-modes">
              {isGame ? (
                <span className="active">
                  <Gamepad2 size={14} /> <LocalizedText text="Game" />
                </span>
              ) : (
                (['Learn', 'Explore'] as const).map((m) => (
                  <button key={m} className={m === mode ? 'active' : ''} onClick={() => setMode(m)}>
                    {m === 'Learn' ? <BookOpen size={12} /> : <Compass size={12} />}{' '}
                    <LocalizedText text={m} />
                  </button>
                ))
              )}
            </div>
          </div>
          <div
            className={
              'interactive-stage ' +
              (scene.type === 'TIMELINE'
                ? 'history-stage'
                : scene.type === 'FRACTION_PIZZA'
                  ? 'pizza-stage'
                  : '')
            }
            ref={stageRef}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={scene.id + '-' + reset}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onAnimationComplete={syncSvgPlayback}
              >
                {Renderer ? (
                  <Renderer
                    scene={scene}
                    subject={definition.subject}
                    onChange={setResult}
                    playing={isGame ? playing : playing && !reducedMotion}
                    onPlayingChange={setPlaying}
                    lessonId={data.id}
                    lessonVersion={data.lessonVersion}
                    replayFromStart={reset > 0}
                    onQuizComplete={quizComplete}
                  />
                ) : (
                  <ErrorState message="This activity type is not available in the current lesson player." />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="stage-bottom">
            <div className="stage-actions">
              <button
                className="text-button"
                onClick={() => {
                  setReset((old) => old + 1);
                  setResult(null);
                }}
              >
                <RotateCcw size={14} />
                <LocalizedText text="Reset" />
              </button>
              {(scene.type === 'ANIMATION' || (isGame && !isWorldGame)) && (
                <button className="text-button" onClick={() => setPlaying(!playing)}>
                  {playing ? <Pause size={14} /> : <Play size={14} />}{' '}
                  <LocalizedText text={playing ? 'Pause' : 'Play'} />
                </button>
              )}
              <button className="text-button" onClick={() => setHint(true)}>
                <Lightbulb size={14} />
                <LocalizedText text="A little hint" />
              </button>
            </div>
            <span className={ready ? 'stage-ready' : 'stage-waiting'}>
              {ready ? (
                <>
                  <Check size={14} />
                  <LocalizedText text="Ready for the next discovery" />
                </>
              ) : (
                <LocalizedText text="Explore this activity to continue" />
              )}
            </span>
          </div>
          {saveError && (
            <p className="inline-error" role="alert">
              <LocalizedText text={saveError} />
            </p>
          )}
        </section>
        <LearningNotes forest={isWorldGame}>
          <aside className="player-aside">
            <div className="panel explanation-panel">
              <span className="panel-kicker">
                <Lightbulb size={16} />
                <LocalizedText text="Make it click" />
              </span>
              <h3>{scene.title}</h3>
              <p>{scene.explanation}</p>
              {mode === 'Learn' && activityInstructions && (
                <div className="instruction-note">
                  <strong>
                    <LocalizedText text="Your little challenge" />
                  </strong>
                  <p>
                    <LocalizedText text={activityInstructions} />
                  </p>
                </div>
              )}
            </div>
            <div className="panel objectives-panel">
              <span className="panel-kicker">
                <Target size={16} />
                <LocalizedText text="Your discoveries" />
              </span>
              {definition.objectives.map((objective, i) => (
                <div key={i}>
                  <span className={completed.length === definition.scenes.length ? 'checked' : ''}>
                    <Check size={11} />
                  </span>
                  <p>{objective}</p>
                </div>
              ))}
            </div>
            <div className="player-mascot-note">
              <Mascot />
              <p>
                <LocalizedText text="You don’t have to know it all." />
                <br />
                <LocalizedText text="You just have to be curious." />
              </p>
            </div>
          </aside>
        </LearningNotes>
      </div>
      <div className="player-controls">
        <button
          className="button secondary"
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
        >
          <ArrowLeft size={16} />
          <LocalizedText text="Previous" />
        </button>
        <span>
          <LocalizedText text="One little discovery at a time." />
        </span>
        <button
          className="button primary"
          onClick={() => void advance()}
          disabled={!ready || saving}
        >
          {saving ? <LoaderCircle size={16} className="spin" /> : null}
          <LocalizedText
            text={index === definition.scenes.length - 1 ? 'Finish my adventure' : 'Next discovery'}
          />
          <ArrowRight size={16} />
        </button>
      </div>
      {hint && (
        <Modal title={'A little nudge in the right direction'} onClose={() => setHint(false)}>
          <p>
            <LocalizedText
              text={
                isGame
                  ? activityInstructions || scene.explanation
                  : scene.type === 'FRACTION_PIZZA'
                    ? `Choose ${scene.parts} equal slices, then click ${scene.target} slice. The number of selected slices goes on top of the fraction.`
                    : scene.type === 'TIMELINE'
                      ? 'Start with the earliest year and explore every milestone. Look closely at the 1957 event.'
                      : scene.type === 'FLASHCARD'
                        ? 'Click each card to turn it over. Take a moment to explain the answer in your own words.'
                        : scene.type === 'QUIZ'
                          ? 'Read the question carefully. Think back to the ideas you explored in the earlier activities.'
                          : scene.explanation
              }
            />
          </p>
          <button
            className="button primary"
            style={{ marginTop: 20 }}
            onClick={() => setHint(false)}
          >
            <LocalizedText text="Got it. Let’s try." />
          </button>
        </Modal>
      )}
    </div>
  );
}
