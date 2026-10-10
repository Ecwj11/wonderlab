'use client';
import Link from 'next/link';
import type { FamilyDashboard, FamilyChild, LearningAccess } from '@wonderlab/shared';
import { Users, Sparkles, CalendarDays, ArrowRight } from 'lucide-react';
import { useApi, Loading, ErrorState, ProgressBar } from './ui';
import { LocalizedText } from './i18n';
export const avatars = { fox: '🦊', owl: '🦉', panda: '🐼', rocket: '🚀' };
export const familyDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
export const money = (cents: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(cents / 100);
export function AccessBadge({ access }: { access: LearningAccess }) {
  const labels = {
    TRIALING: 'Trial active',
    ACTIVE: 'Subscription active',
    EXPIRED: 'Access expired',
    NONE: 'No active subscription',
    SUSPENDED: 'Family paused',
  };
  return (
    <span className={'family-badge ' + (access.canLearn ? 'positive' : 'muted')}>
      <LocalizedText text={labels[access.status]} />
    </span>
  );
}
export function ChildSummary({ child }: { child: FamilyChild }) {
  return (
    <div className="family-child-summary">
      <span className={'family-avatar ' + child.avatar} aria-hidden="true">
        {avatars[child.avatar]}
      </span>
      <div className="family-child-summary-body">
        <div className="family-row">
          <h3>{child.name}</h3>
          <span className={'family-badge ' + (child.status === 'ACTIVE' ? 'positive' : 'muted')}>
            <LocalizedText text={child.status === 'ACTIVE' ? 'Learning enabled' : 'Paused'} />
          </span>
        </div>
        <p>
          {child.schoolLevel} <span>·</span> <LocalizedText text={`Level ${child.stats.level}`} />
        </p>
        <div className="family-child-stats">
          <span>
            <strong>{child.stats.xp}</strong> <LocalizedText text="XP earned" />
          </span>
          <span>
            <strong>{child.stats.completed}</strong> <LocalizedText text="Lessons completed" />
          </span>
          <span>
            <strong>{child.stats.streak}</strong> <LocalizedText text="Day streak" />
          </span>
        </div>
        <div className="family-row family-time-label">
          <span>
            <LocalizedText text="Learning time today" />
          </span>
          <span>
            {Math.floor(child.learningSecondsToday / 60)} / {child.dailyMinutesLimit}{' '}
            <LocalizedText text="min" />
          </span>
        </div>
        <ProgressBar value={(child.learningSecondsToday / (child.dailyMinutesLimit * 60)) * 100} />
      </div>
    </div>
  );
}
export function ParentDashboard() {
  const { data, error, loading, reload } = useApi<FamilyDashboard>('/parent/dashboard');
  if (loading) return <Loading label="Loading your family space…" />;
  if (error || !data)
    return (
      <ErrorState message={error || 'Unable to load your family.'} retry={() => void reload()} />
    );
  return (
    <>
      <div className="family-heading">
        <h1>
          <LocalizedText text="A little learning, every day." />
        </h1>
        <p>
          <LocalizedText text="See how your children are growing, and guide their next adventure." />
        </p>
      </div>
      <section className="family-welcome">
        <div>
          <h2>{data.family.name}</h2>
          <p>
            <LocalizedText text="One family. A world to discover." />
          </p>
          <AccessBadge access={data.access} />
          {data.access.canGenerate && (
            <Link className="family-create-link" href="/parent/create">
              <Sparkles size={16} />
              <LocalizedText text="Create a lesson for your family" />
            </Link>
          )}
        </div>
        <div className="family-code">
          <span>
            <LocalizedText text="Family login code" />
          </span>
          <strong>{data.family.code}</strong>
          <small>
            <LocalizedText text="Children use this code with their username and passcode." />
          </small>
        </div>
      </section>
      <div className="family-overview">
        <div>
          <Users size={21} />
          <strong>
            {data.children.length} / {data.access.childLimit}
          </strong>
          <LocalizedText text="Child profiles" />
        </div>
        <div>
          <Sparkles size={21} />
          <strong>
            {data.access.generationUsed} / {data.access.generationLimit}
          </strong>
          <LocalizedText text="Lessons created this period" />
        </div>
        <div>
          <CalendarDays size={21} />
          <strong>{familyDate(data.access.periodEndsAt)}</strong>
          <LocalizedText
            text={data.access.status === 'TRIALING' ? 'Trial ends' : 'Current period ends'}
          />
        </div>
      </div>
      {!data.access.canLearn && (
        <div className="family-notice">
          <p>
            {data.access.reason || (
              <LocalizedText text="Choose a plan to keep learning together." />
            )}
          </p>
          <Link href="/parent/billing" className="button primary">
            <LocalizedText text="View subscription" />
          </Link>
        </div>
      )}
      <section className="family-panel">
        <div className="family-row family-section-heading">
          <div>
            <h2>
              <LocalizedText text="Your young explorers" />
            </h2>
            <p>
              <LocalizedText text="Individual progress, shared possibilities." />
            </p>
          </div>
          <Link href="/parent/children" className="family-text-link">
            <LocalizedText text="Manage children" />
            <ArrowRight size={17} />
          </Link>
        </div>
        {data.children.length ? (
          <div className="family-child-list">
            {data.children.map((child) => (
              <ChildSummary key={child.id} child={child} />
            ))}
          </div>
        ) : (
          <div className="family-empty">
            <span aria-hidden="true">🦊</span>
            <h3>
              <LocalizedText text="Meet your first explorer" />
            </h3>
            <p>
              <LocalizedText text="Add a child profile to give them their own learning adventure." />
            </p>
            <Link className="button primary" href="/parent/children">
              <LocalizedText text="Add child" />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
