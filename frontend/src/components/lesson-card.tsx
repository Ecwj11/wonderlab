'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Play,
  Copy,
  Share2,
  RotateCcw,
  Trash2,
  Check,
  LoaderCircle,
} from 'lucide-react';
import { canCreateLessons, type LessonSummary, subjectLabels } from '@wonderlab/shared';
import { ProgressBar, Modal } from './ui';
import { useSession } from './session';
import { api } from '@/lib/api';
export function LessonCard({
  lesson,
  library = false,
  onChange,
}: {
  lesson: LessonSummary;
  library?: boolean;
  onChange?: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const canCreate = canCreateLessons(user);

  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'delete' | 'share' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const tint =
    lesson.subject === 'MATHEMATICS'
      ? 'coral'
      : lesson.subject === 'SCIENCE'
        ? 'mint'
        : lesson.subject === 'HISTORY'
          ? 'peach'
          : lesson.subject === 'GEOGRAPHY'
            ? 'blue'
            : 'lavender';
  const state =
    lesson.status === 'GENERATING'
      ? 'preparing'
      : lesson.status === 'FAILED'
        ? 'failed'
        : lesson.progressStatus === 'COMPLETED' || lesson.progress >= 100
          ? 'completed'
          : lesson.progressStatus === 'IN_PROGRESS' || lesson.progress > 0
            ? 'progress'
            : 'ready';
  const statusLabel = {
    preparing: 'Preparing…',
    ready: 'Ready to play',
    progress: 'In progress',
    completed: 'Completed',
    failed: 'Could not prepare',
  }[state];
  const statusMessage = {
    preparing: 'Your lesson is being prepared. You can come back anytime.',
    ready: 'Everything is ready. Start your next discovery.',
    progress: 'Your progress is saved. Pick up where you left off.',
    completed: 'You finished this adventure. Try it again anytime.',
    failed: 'This lesson could not be prepared. Try again.',
  }[state];
  const actionLabel = {
    preparing: 'Check progress',
    ready: 'Start lesson',
    progress: 'Continue learning',
    completed: 'Play again',
    failed: 'Try again',
  }[state];
  const progress = Math.min(100, Math.max(0, lesson.progress));
  const created = new Date(lesson.createdAt).toLocaleDateString('en-CA');
  const start = async () => {
    if (lesson.status === 'FAILED') {
      setBusy(true);
      try {
        await api('/lessons/' + lesson.id + '/regenerate', { method: 'POST' });
        router.push('/app/lesson/' + lesson.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to retry generation.');
        setBusy(false);
      }
      return;
    }
    if (!library) {
      router.push('/app/lesson/' + lesson.id + (state === 'completed' ? '?restart=1' : ''));
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ id: string }>('/lessons/' + lesson.id + '/duplicate', {
        method: 'POST',
      });
      router.push('/app/lesson/' + result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again.');
      setBusy(false);
    }
  };
  const action = async (kind: 'duplicate' | 'delete' | 'share') => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'duplicate') {
        await api('/lessons/' + lesson.id + '/duplicate', { method: 'POST' });
        onChange?.();
      }
      if (kind === 'delete') {
        await api('/lessons/' + lesson.id, { method: 'DELETE' });
        setModal(null);
        onChange?.();
      }
      if (kind === 'share') {
        await api('/lessons/' + lesson.id, {
          method: 'PATCH',
          body: JSON.stringify({ visibility: 'UNLISTED' }),
        });
        setModal('share');
      }
      setMenu(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={'lesson-card lesson-status-card status-' + state}
      data-lesson-status={state}
    >
      <div className={'lesson-status-head status-' + state}>
        <span className="lesson-state" role="status">
          {state === 'preparing' ? (
            <LoaderCircle size={18} className="spin" />
          ) : state === 'completed' ? (
            <Check size={18} />
          ) : null}
          <LocalizedText text={statusLabel} />
        </span>
        {!library && canCreate && (
          <div className="card-menu-wrap">
            <button
              className="card-menu-button"
              aria-label={t('Actions for ' + lesson.title)}
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
            >
              <MoreHorizontal size={19} />
            </button>
            {menu && (
              <div className="card-menu">
                <button onClick={() => void action('duplicate')}>
                  <Copy size={14} />
                  <LocalizedText text="Duplicate" />
                </button>
                <Link
                  href={'/app/lesson/' + lesson.id + '?restart=1'}
                  onClick={() => setMenu(false)}
                >
                  <RotateCcw size={14} />
                  <LocalizedText text="Restart practice" />
                </Link>
                <button onClick={() => void action('share')}>
                  <Share2 size={14} />
                  <LocalizedText text="Share" />
                </button>
                <button
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    setModal('delete');
                  }}
                >
                  <Trash2 size={14} />
                  <LocalizedText text="Delete" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="lesson-card-body">
        <div className="card-subject-row">
          <span className={'subject-tag ' + tint}>
            <LocalizedText text={subjectLabels[lesson.subject]} />
          </span>
          <span className="lesson-language">
            {lesson.language === 'Bahasa Melayu'
              ? 'BM'
              : lesson.language === 'Chinese'
                ? '中文'
                : 'EN'}
          </span>
        </div>
        <h3>{lesson.title}</h3>
        <p className="lesson-status-message">
          <LocalizedText
            text={
              state === 'failed' && !canCreate
                ? 'Ask your parent to prepare this lesson again.'
                : statusMessage
            }
          />
        </p>
        {(state === 'progress' || state === 'completed') && !library && (
          <div className="card-progress">
            <div className="card-progress-label">
              <span>
                <LocalizedText text="Lesson progress" />
              </span>
              <strong>{progress}%</strong>
            </div>
            <ProgressBar value={progress} />
            {lesson.bestScore !== null && (
              <span className="card-best-score">
                <LocalizedText text={`Best quiz score: ${lesson.bestScore}%`} />
              </span>
            )}
          </div>
        )}
        <div className="lesson-details-row">
          <span>
            <LocalizedText text={lesson.schoolLevel} />
          </span>
          {lesson.status === 'READY' && lesson.sceneCount > 0 && (
            <span>
              <LocalizedText text={`${lesson.sceneCount} activities`} />
            </span>
          )}
        </div>
        <div className="lesson-created">
          <LocalizedText text={`Created ${created}`} />
        </div>
        <div className="card-footer lesson-action-footer">
          <button
            className={
              'button lesson-card-action ' + (state === 'failed' ? 'secondary' : 'primary')
            }
            aria-label={t(
              (library
                ? 'Start '
                : state === 'completed'
                  ? 'Replay '
                  : lesson.progress
                    ? 'Continue '
                    : 'Open ') + lesson.title,
            )}
            onClick={() => void start()}
            disabled={busy || (state === 'failed' && (library || !canCreate))}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : state === 'completed' || state === 'failed' ? (
              <RotateCcw size={16} />
            ) : state === 'preparing' ? (
              <LoaderCircle size={16} />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            <LocalizedText
              text={state === 'failed' && !canCreate ? 'Ask your parent' : actionLabel}
            />
          </button>
        </div>
        {error && (
          <p className="inline-error">
            <LocalizedText text={error} />
          </p>
        )}
      </div>
      {modal === 'delete' && (
        <Modal title={'Delete this lesson?'} onClose={() => setModal(null)}>
          <p>
            <LocalizedText
              text={`“${lesson.title}” and its saved progress will be removed. Earned XP stays in your account.`}
            />
          </p>
          {error && (
            <p className="inline-error">
              <LocalizedText text={error} />
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              <LocalizedText text="Keep lesson" />
            </button>
            <button className="button danger" onClick={() => void action('delete')} disabled={busy}>
              <LocalizedText text={busy ? 'Deleting…' : 'Delete lesson'} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title={'Share a little discovery'} onClose={() => setModal(null)}>
          <p>
            <LocalizedText text="Your lesson is now unlisted. Anyone with this link and a Wonderlab account can explore it." />
          </p>
          <div className="share-link">
            {typeof window !== 'undefined' ? window.location.origin : ''}/app/lesson/{lesson.id}
          </div>
          <button
            className="button primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + '/app/lesson/' + lesson.id,
                );
                setCopied(true);
              } catch {
                setError('Select and copy the link above.');
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
            <LocalizedText text={copied ? 'Link copied' : 'Copy lesson link'} />
          </button>
          {error && (
            <p className="inline-error">
              <LocalizedText text={error} />
            </p>
          )}
        </Modal>
      )}
    </article>
  );
}
