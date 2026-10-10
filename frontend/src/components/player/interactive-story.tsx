'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  Target,
} from 'lucide-react';
import type {
  PublicInteractiveStory,
  StoryAnswer,
  StoryCheckResult,
  StoryState,
} from '@wonderlab/shared';
import { api } from '@/lib/api';
import { NarrationTransport, type NarrationState } from '@/lib/narration';
import { useMusicDucking } from '../music';
import { useSounds } from '../sounds';
import { StoryWorld3D } from './story-world-3d';
import type { SceneProps } from './types';

export function InteractiveStoryScene({
  scene,
  lessonId,
  lessonVersion,
  replayFromStart = false,
  playing,
  onPlayingChange,
  onChange,
}: SceneProps<PublicInteractiveStory>) {
  const { play: sound } = useSounds();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<StoryAnswer[]>([]);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [narration, setNarration] = useState<NarrationState>({
    status: 'idle',
    volume: 0.8,
    rate: 1,
  });
  const audio = useRef<HTMLAudioElement>(null);
  const transport = useRef<NarrationTransport | null>(null);
  const mounted = useRef(false);
  const checking = useRef(false);
  const voiceMode = useRef(true);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  }, []);
  const loadGeneration = useRef(0);
  const step = scene.steps[index];
  const finished = answers.length === scene.steps.length;
  const narrating = narration.status === 'playing' || narration.status === 'loading';
  const interactive = started && ready && playing && !narrating && !busy && !solved && !finished;
  useMusicDucking(narrating);

  useEffect(() => {
    mounted.current = true;
    const player = new NarrationTransport(audio.current!, (state) => {
      setNarration(state);
      if (state.status === 'ended') setReady(true);
      else if (state.status === 'loading' || state.status === 'playing') setReady(false);
    });
    transport.current = player;
    try {
      const stored = Number(localStorage.getItem('wonderlab.story.voice-volume') ?? 0.8);
      if (Number.isFinite(stored)) player.setVolume(stored);
    } catch {
      /* Optional device preference. */
    }
    return () => {
      mounted.current = false;
      cancelAdvance();
      loadGeneration.current++;
      player.dispose();
      transport.current = null;
    };
  }, [cancelAdvance]);
  const restore = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    if (replayFromStart) {
      setAnswers([]);
      setIndex(0);
      setLoading(false);
      return;
    }
    try {
      const state = await api<StoryState>(
        `/lessons/${lessonId}/story/state?sceneId=${encodeURIComponent(scene.id)}&lessonVersion=${lessonVersion}`,
      );
      if (!mounted.current || generation !== loadGeneration.current) return;
      setAnswers(state.answers);
      setIndex(Math.min(state.answers.length, scene.steps.length - 1));
    } catch (e) {
      if (mounted.current && generation === loadGeneration.current)
        setError(e instanceof Error ? e.message : '无法载入故事，请再试一次。');
    } finally {
      if (mounted.current && generation === loadGeneration.current) setLoading(false);
    }
  }, [lessonId, lessonVersion, scene.id, scene.steps.length, replayFromStart]);
  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(() => {
    onChange(finished ? { storyAnswers: answers } : null);
  }, [answers, finished, onChange]);
  useEffect(() => {
    if (!playing) {
      cancelAdvance();
      transport.current?.pause();
    }
  }, [playing, cancelAdvance]);
  useEffect(() => {
    if (finished) transport.current?.pause();
  }, [finished]);
  useEffect(() => {
    const away = () => {
      cancelAdvance();
      transport.current?.pause();
      onPlayingChange?.(false);
    };
    const visibility = () => {
      if (document.hidden) away();
    };
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [onPlayingChange, cancelAdvance]);
  const narrate = (replay = false) => {
    cancelAdvance();
    voiceMode.current = true;
    setReady(false);
    onPlayingChange?.(true);
    if (!transport.current) return;
    if (transport.current.snapshot().status === 'idle') transport.current.load(step.narrationSrc);
    void (replay ? transport.current.replay() : transport.current.play());
  };
  const start = (voice: boolean) => {
    cancelAdvance();
    setStarted(true);
    voiceMode.current = voice;
    onPlayingChange?.(true);
    transport.current?.load(step.narrationSrc);
    if (voice) {
      void transport.current?.play();
    } else {
      transport.current?.pause();
      setReady(true);
    }
  };
  const choose = async (choiceId: string) => {
    if (!interactive || checking.current) return;
    checking.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<StoryCheckResult>(`/lessons/${lessonId}/story/check`, {
        method: 'POST',
        body: JSON.stringify({ lessonVersion, sceneId: scene.id, stepId: step.id, choiceId }),
      });
      if (!mounted.current) return;
      sound(result.correct ? 'correct' : 'incorrect');
      setFeedback({ correct: result.correct, text: result.feedback });
      if (result.correct) {
        setSolved(true);
        setAnswers((old) =>
          old.some((answer) => answer.stepId === step.id)
            ? old
            : [...old, { stepId: result.stepId, choiceId: result.choiceId }],
        );
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '请再试一次。');
    } finally {
      checking.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const reach = (target: string) => {
    const choice = step.task.choices.find((option) => option.target === target);
    if (choice) void choose(choice.id);
  };
  const next = useCallback(() => {
    if (!solved || busy || index >= scene.steps.length - 1) return;
    cancelAdvance();
    const upcoming = scene.steps[index + 1];
    setIndex(index + 1);
    setSolved(false);
    setFeedback(null);
    setError('');
    setReady(!voiceMode.current);
    transport.current?.load(upcoming.narrationSrc);
    if (voiceMode.current) void transport.current?.play();
    onPlayingChange?.(true);
  }, [solved, busy, index, scene.steps, cancelAdvance, onPlayingChange]);
  useEffect(() => {
    cancelAdvance();
    if (solved && !busy && !finished && playing && !narrating) {
      // Keep the success feedback visible briefly before the next paragraph.
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (!document.hidden) next();
      }, 900);
    }
    return cancelAdvance;
  }, [solved, busy, finished, playing, narrating, next, cancelAdvance]);
  const replayStory = () => {
    cancelAdvance();
    transport.current?.pause();
    setAnswers([]);
    setIndex(0);
    setStarted(false);
    setReady(false);
    setSolved(false);
    setFeedback(null);
    setError('');
  };
  return (
    <section
      className="story3d-game"
      lang="zh-Hans"
      data-story-step={step.id}
      data-story-ready={ready}
    >
      <audio ref={audio} preload="none" hidden data-story-narration aria-hidden="true" />
      <header className="story3d-heading">
        <span className="story3d-book">
          <BookOpen size={22} />
        </span>
        <div>
          <small>中文 · 3D 有声故事</small>
          <strong>{scene.title}</strong>
        </div>
        <ol aria-label="故事进度">
          {scene.steps.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === index && !finished ? 'step' : undefined}
              data-done={answers.some((a) => a.stepId === s.id)}
            >
              {answers.some((a) => a.stepId === s.id) ? <Check size={12} /> : i + 1}
            </li>
          ))}
        </ol>
        {started && !finished && (
          <button className="story3d-quiet" onClick={replayStory}>
            <RotateCcw size={15} />
            从头再玩
          </button>
        )}
      </header>
      <div
        className="story3d-mission"
        data-story-mission
        data-phase={finished || solved ? 'done' : interactive ? 'action' : 'listen'}
      >
        <div className="story3d-mission-heading">
          <span className="story3d-mission-icon" aria-hidden="true">
            {finished || solved ? (
              <Check size={20} />
            ) : narrating ? (
              <Headphones size={20} />
            ) : (
              <Target size={20} />
            )}
          </span>
          <span role="status">
            {finished
              ? '故事通关啦！'
              : solved
                ? '任务完成！'
                : busy
                  ? '正在确认你的选择…'
                  : !started
                    ? '先开始故事'
                    : !playing
                      ? '故事暂停了'
                      : interactive
                        ? '现在轮到你！'
                        : '先听故事，马上轮到你'}
          </span>
          <small>
            {Math.min(index + 1, scene.steps.length)} / {scene.steps.length}
          </small>
        </div>
        <strong>{finished ? '你完成了全部小任务！' : step.task.prompt}</strong>
        <p>
          {finished
            ? '点击页面底部的完成按钮，保存学习进度并领取奖励。'
            : solved
              ? playing
                ? '做到了！马上自动继续故事…'
                : '故事已暂停。点击“故事继续”进入下一段。'
              : !started
                ? '点击“开始听故事”，听一段，再完成这个任务。'
                : !playing
                  ? '点击“继续故事”，就可以接着听和玩。'
                  : !ready
                    ? '先听完这一段，或读好课文后点击“读好了，开始互动”。'
                    : step.task.type === 'QUESTION'
                      ? '请点击下面的答案。选错了也没关系，可以再试。'
                      : '点击场景里的标牌，小雨会自动走过去。方向键也能移动，走近后按空格互动。'}
        </p>
        {started && !finished && !solved && step.task.type === 'QUESTION' && (
          <div className="story3d-choices">
            {step.task.choices.map((choice) => (
              <button
                key={choice.id}
                data-story-choice={choice.id}
                data-sound="off"
                disabled={!interactive}
                onClick={() => void choose(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        {feedback && !finished && (
          <p className="story3d-mission-feedback" data-correct={feedback.correct} role="status">
            {feedback.correct ? '✓ ' : '再试一次：'}
            {feedback.text}
          </p>
        )}
        {solved && !finished && playing && (
          <button
            className="story3d-quiet"
            onClick={() => {
              cancelAdvance();
              transport.current?.pause();
              onPlayingChange?.(false);
            }}
          >
            <Pause size={17} />
            暂停自动继续
          </button>
        )}
        {solved && !finished && (
          <button className="story3d-primary" onClick={next}>
            故事继续
            <ChevronRight size={18} />
          </button>
        )}
        {started && !playing && !finished && !solved && (
          <button
            className="story3d-primary"
            onClick={() => {
              onPlayingChange?.(true);
              if (voiceMode.current && transport.current?.snapshot().status === 'paused') narrate();
            }}
          >
            继续故事
            <Play size={17} />
          </button>
        )}
      </div>
      <div className="story3d-world-wrap">
        <StoryWorld3D
          active={interactive}
          targets={
            interactive
              ? step.task.choices.flatMap((choice) => (choice.target ? [choice.target] : []))
              : []
          }
          onReach={reach}
          growth={answers.length / scene.steps.length}
        />
        {!started && !finished && (
          <div className="story3d-intro">
            <span>
              <Headphones size={30} />
            </span>
            <small>把课文变成一场冒险</small>
            <h3>
              跟小雨一起，
              <br />
              让小种子开花。
            </h3>
            <p>
              听故事，走进花园，找东西。
              <br />
              每一步，都由你来帮忙。
            </p>
            <button
              className="story3d-primary"
              disabled={loading || !!error}
              onClick={() => start(true)}
            >
              <Play size={18} />
              {answers.length ? '继续听故事' : '开始听故事'}
            </button>
            <button
              className="story3d-quiet"
              disabled={loading || !!error}
              onClick={() => start(false)}
            >
              我想自己读
            </button>
            {loading && <p role="status">正在打开故事…</p>}
          </div>
        )}
      </div>
      {error && (
        <div className="story3d-error" role="alert">
          {error}
          {!started && <button onClick={() => void restore()}>重新载入</button>}
        </div>
      )}
      {finished ? (
        <div className="story3d-ending">
          <span>🌼</span>
          <h3>小种子开花了，你也长大了一点！</h3>
          <p>你学会了观察、关心和“一同”努力。点击下方“完成冒险”，保存这次学习并领取经验值。</p>
          <button className="story3d-quiet" onClick={replayStory}>
            <RotateCcw size={16} />
            再玩一次故事
          </button>
        </div>
      ) : (
        started && (
          <div className="story3d-reader">
            <div className="story3d-chapter">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <span className="story3d-voice-state" role="status">
                {narrating ? '正在朗读…' : ready ? '轮到你啦' : '听一听，读一读'}
              </span>
            </div>
            <p className="story3d-text">{step.text}</p>
            <div className="story3d-voice-controls">
              <button
                onClick={() => {
                  if (narrating) {
                    cancelAdvance();
                    transport.current?.pause();
                    onPlayingChange?.(false);
                  } else narrate();
                }}
              >
                <span>{narrating ? <Pause size={16} /> : <Play size={16} />}</span>
                {narrating ? '暂停故事' : '继续朗读'}
              </button>
              <button onClick={() => narrate(true)}>
                <RotateCcw size={15} />
                重听这一段
              </button>
              <details>
                <summary>
                  <Volume2 size={16} />
                  朗读设置
                </summary>
                <div>
                  <label>
                    旁白音量
                    <input
                      type="range"
                      aria-label="旁白音量"
                      min="0"
                      max="100"
                      value={Math.round(narration.volume * 100)}
                      onChange={(e) => {
                        const value = Number(e.target.value) / 100;
                        transport.current?.setVolume(value);
                        try {
                          localStorage.setItem('wonderlab.story.voice-volume', String(value));
                        } catch {
                          /* Storage is optional. */
                        }
                      }}
                    />
                  </label>
                  <label>
                    朗读速度
                    <select
                      aria-label="朗读速度"
                      value={narration.rate}
                      onChange={(e) => transport.current?.setRate(Number(e.target.value))}
                    >
                      <option value="0.8">慢一点</option>
                      <option value="1">正常</option>
                      <option value="1.25">快一点</option>
                    </select>
                  </label>
                </div>
              </details>
              {!ready && (
                <button
                  className="story3d-quiet"
                  onClick={() => {
                    cancelAdvance();
                    transport.current?.pause();
                    setReady(true);
                    onPlayingChange?.(true);
                  }}
                >
                  读好了，开始互动
                </button>
              )}
            </div>
            {narration.status === 'error' && (
              <p className="story3d-error" role="alert">
                旁白暂时无法播放。可以重听，或阅读上面的课文后开始互动。
              </p>
            )}
            <div className="story3d-task" data-task-type={step.task.type}>
              <span className="story3d-task-label">
                {busy ? <LoaderCircle size={17} className="spin" /> : '✦'}
                {busy ? '正在确认…' : '你的小任务'}
              </span>
              <strong>{step.task.prompt}</strong>
              {step.task.type === 'QUESTION' ? (
                <p>在游戏场景上方的任务栏选择答案。</p>
              ) : (
                <p>
                  {ready
                    ? '点击场景里的标牌，小雨会走过去。也可以用方向键移动，按空格互动。'
                    : '先听完这一段，再走进故事里。'}
                </p>
              )}
            </div>
            {feedback && (
              <div className="story3d-feedback" role="status" data-correct={feedback.correct}>
                {feedback.correct ? <Check size={20} /> : <BookOpen size={20} />}
                <p>{feedback.text}</p>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
