'use client';
import { useSounds } from '../sounds';
import { LocalizedText } from '@/components/i18n';
import { useState, useEffect, useRef } from 'react';
import { Check, X, ArrowRight, LoaderCircle, Trophy, Zap } from 'lucide-react';
import type { PublicScene, QuizResult } from '@wonderlab/shared';
import { api } from '@/lib/api';
import type { SceneProps } from './types';
export function QuizScene({
  scene,
  lessonId,
  lessonVersion,
  onChange,
  onQuizComplete,
}: SceneProps<Extract<PublicScene, { type: 'QUIZ' }>>) {
  const { play } = useSounds();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const started = useRef(Date.now());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, QuizResult['feedback'][number]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const question = scene.questions[index];
  const checked = feedback[question.id];
  useEffect(() => {
    onChange(result ? { viewed: true } : null);
  }, [result, onChange]);
  const choose = async (optionId: string) => {
    if (checked || busy) return;
    setBusy(true);
    setError('');
    try {
      const checked = await api<QuizResult['feedback'][number] & { optionId: string }>(
        `/lessons/${lessonId}/quiz/check`,
        {
          method: 'POST',
          body: JSON.stringify({
            lessonVersion,
            sceneId: scene.id,
            questionId: question.id,
            optionId,
          }),
        },
      );
      if (!mounted.current) return;
      play(checked.correct ? 'correct' : 'incorrect');
      setAnswers((a) => ({ ...a, [question.id]: checked.optionId }));
      setFeedback((f) => ({ ...f, [question.id]: checked }));
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Try this answer again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api<QuizResult>(`/lessons/${lessonId}/quiz/submit`, {
        method: 'POST',
        body: JSON.stringify({
          lessonVersion,
          sceneId: scene.id,
          answers: scene.questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] })),
          elapsedSeconds: Math.min(600, Math.floor((Date.now() - started.current) / 1000)),
        }),
      });
      if (!mounted.current) return;
      play('victory');
      setResult(result);
      onQuizComplete(result);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'Please try submitting again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  if (result)
    return (
      <div className="quiz-summary">
        <div className="quiz-trophy">
          <Trophy size={46} />
        </div>
        <h3>
          <LocalizedText
            text={result.score === 100 ? 'You’re a quiz whiz!' : 'A little wiser than before.'}
          />
        </h3>
        <p>
          <LocalizedText text={`${result.correct} of ${result.total} ideas clicked.`} />{' '}
          <LocalizedText
            text={
              result.score === 100
                ? 'That’s a perfect score.'
                : 'Every answer is a chance to learn.'
            }
          />
        </p>
        <div className="quiz-result-score">
          {result.score}
          <span>%</span>
        </div>
        <div className="quiz-earned">
          <Zap size={16} />
          <LocalizedText
            text={
              result.alreadySubmitted
                ? 'Practice complete · XP already earned'
                : `+${result.xpEarned} XP earned`
            }
          />
        </div>
      </div>
    );
  return (
    <div className="quiz-scene">
      <div className="quiz-top">
        <span className="subject-tag lavender">
          <LocalizedText text="A little brain workout" />
        </span>
        <span>
          <LocalizedText text={`Question ${index + 1} of ${scene.questions.length}`} />
        </span>
      </div>
      <div className="quiz-dots">
        {scene.questions.map((q, i) => (
          <span key={q.id} className={feedback[q.id] ? 'done' : i === index ? 'active' : ''} />
        ))}
      </div>
      <h3>{question.prompt}</h3>
      <div className="quiz-options">
        {question.options.map((option, i) => {
          const selected = answers[question.id] === option.id;
          const correct = checked?.correctOptionId === option.id;
          return (
            <button
              key={option.id}
              disabled={!!checked || busy}
              className={
                (checked && correct ? 'correct ' : checked && selected ? 'incorrect ' : '') +
                (selected ? 'selected' : '')
              }
              onClick={() => void choose(option.id)}
            >
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              <span>{option.label}</span>
              {checked && correct ? (
                <Check size={18} />
              ) : checked && selected ? (
                <X size={18} />
              ) : (
                <span className="option-circle" />
              )}
            </button>
          );
        })}
      </div>
      {busy && (
        <div className="quiz-checking">
          <LoaderCircle size={15} className="spin" />
          <LocalizedText text="Checking your answer…" />
        </div>
      )}
      {checked && (
        <div className={'quiz-feedback ' + (checked.correct ? 'correct' : 'incorrect')}>
          <span>{checked.correct ? <Check size={20} /> : <LightbulbSymbol />}</span>
          <div>
            <strong>
              <LocalizedText
                text={
                  checked.correct
                    ? 'That’s it. You’ve got this!'
                    : 'A little discovery to remember.'
                }
              />
            </strong>
            <p>{checked.explanation}</p>
          </div>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          <LocalizedText text={error} />
        </p>
      )}
      {checked && (
        <div className="quiz-next">
          <button
            className="button primary"
            onClick={() => {
              if (index < scene.questions.length - 1) setIndex(index + 1);
              else void finish();
            }}
            disabled={busy}
          >
            <LocalizedText
              text={index < scene.questions.length - 1 ? 'Next question' : 'Finish my quiz'}
            />
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function LightbulbSymbol() {
  return <span style={{ fontSize: 22 }}>✦</span>;
}
