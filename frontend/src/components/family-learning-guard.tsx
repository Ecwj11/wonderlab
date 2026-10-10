'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, PauseCircle } from 'lucide-react';
import type { LearningAccess } from '@wonderlab/shared';
import { api, RequestError } from '@/lib/api';
import { useSession } from './session';
import { LocalizedText } from './i18n';
import { Loading, ErrorState } from './ui';

export function FamilyLearningGuard({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const path = usePathname();
  const familyId = user?.familyId;
  const isParent = user?.accountType === 'PARENT';
  const [access, setAccess] = useState<LearningAccess | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!familyId) return;
    try {
      setAccess(await api<LearningAccess>('/learning-access'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check your learning access.');
    }
  }, [familyId]);
  useEffect(() => {
    if (!familyId) return;
    let alive = true;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const next = await api<LearningAccess>(
          path.startsWith('/app/lesson/') ? '/learning-heartbeat' : '/learning-access',
          path.startsWith('/app/lesson/') ? { method: 'POST' } : {},
        );
        // Recheck the open lesson too: a parent can narrow subjects or grades
        // while the child is playing without pausing their whole account.
        const lessonId = path.match(/^\/app\/lesson\/([^/]+)$/)?.[1];
        if (user?.accountType === 'CHILD' && next.canLearn && lessonId)
          await api('/lessons/' + encodeURIComponent(lessonId) + '/progress');
        if (alive) {
          setAccess(next);
          setError('');
        }
      } catch (e) {
        if (e instanceof RequestError && e.status === 403) {
          try {
            const next = await api<LearningAccess>('/learning-access');
            if (alive) {
              setAccess(next);
              setError(next.canLearn ? e.message : '');
            }
          } catch (failure) {
            if (alive)
              setError(
                failure instanceof Error
                  ? failure.message
                  : 'Unable to check your learning access.',
              );
          }
        } else if (alive)
          setError(e instanceof Error ? e.message : 'Unable to check your learning access.');
      } finally {
        running = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 15000);
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [familyId, path, user?.accountType]);
  // The legacy create URL redirects child accounts without mounting the form.
  if (path === '/app/create' && user?.accountType === 'CHILD') return <>{children}</>;
  // Earned prizes remain reachable when the daily allowance or trial has ended.
  // The rewards API still checks suspension before accepting a new request.
  if (path === '/app/rewards' && user?.accountType === 'CHILD') return <>{children}</>;
  if (!familyId) return <>{children}</>;
  if (error) return <ErrorState message={error} retry={() => void refresh()} />;
  if (!access) return <Loading label="Checking your family learning access…" />;
  const blockedCreate = ['/app/create', '/parent/create'].includes(path) && !access.canGenerate;
  if (!access.canLearn || blockedCreate)
    return (
      <section className="family-learning-gate" role="status">
        {blockedCreate ? <ShieldCheck size={46} /> : <PauseCircle size={46} />}
        <h2>
          <LocalizedText
            text={
              blockedCreate
                ? isParent
                  ? 'Your family’s creation allowance is unavailable'
                  : 'Ask your parent to create a lesson'
                : 'Time for a little break'
            }
          />
        </h2>
        <p>
          <LocalizedText
            text={
              blockedCreate
                ? isParent
                  ? 'Check your subscription or ask an administrator to update your allowance.'
                  : 'Your parent manages new lessons for your family. You can explore your ready lessons together.'
                : access.reason || 'Ask your parent to check your family learning access.'
            }
          />
        </p>
        <Link href={isParent ? '/parent/billing' : '/app/lessons'} className="button primary">
          <LocalizedText text={isParent ? 'Open family subscription' : 'My lessons'} />
        </Link>
      </section>
    );
  return <>{children}</>;
}
