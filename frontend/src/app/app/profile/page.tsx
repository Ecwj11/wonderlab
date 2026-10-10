'use client';
import { LocalizedText } from '@/components/i18n';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound, Check, LogOut, LoaderCircle } from 'lucide-react';
import { useSession } from '@/components/session';
import { api } from '@/lib/api';
import { ProgressBar } from '@/components/ui';
export default function Profile() {
  const { user, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kuala_Lumpur');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone);
    }
  }, [user]);
  if (!user) return null;
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <UserRound size={14} />
            <LocalizedText text="Your very own corner of Wonderlab" />
          </div>
          <h1>
            <LocalizedText text="A learning space that feels like you." />
          </h1>
          <p>
            <LocalizedText text="A little about the curious mind behind every discovery." />
          </p>
        </div>
      </div>
      <div className="profile-grid">
        <section className="panel profile-card">
          <span className="avatar profile-avatar">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="subject-tag lavender">
            <LocalizedText text={`Level ${user.level} · Curious explorer`} />
          </span>
          <ProgressBar value={(user.xp % 500) / 5} />
          <p>
            <LocalizedText text={`${user.xp.toLocaleString()} XP earned`} />
          </p>
        </section>
        <form
          className="panel profile-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setSaved(false);
            setError('');
            try {
              await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ name, timezone }) });
              await refresh();
              setSaved(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to save.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            <LocalizedText text="Your details" />
          </h2>
          <p style={{ marginBottom: 25 }}>
            <LocalizedText text="Small changes, a more personal learning space." />
          </p>
          <label>
            <LocalizedText text="Your name" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </label>
          <label>
            <LocalizedText text="Email address" />
            <input value={user.email} readOnly type="email" />
          </label>
          <label>
            <LocalizedText text="Your timezone" />
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {Array.from(
                new Set([
                  user.timezone,
                  'Asia/Kuala_Lumpur',
                  'Asia/Singapore',
                  'Asia/Shanghai',
                  'Asia/Tokyo',
                  'Europe/London',
                  'America/New_York',
                  'America/Los_Angeles',
                  'UTC',
                ]),
              ).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="field-caption">
              <LocalizedText text="Your learning streak follows your local calendar day." />
            </span>
          </label>
          {error && (
            <p className="inline-error" role="alert">
              <LocalizedText text={error} />
            </p>
          )}
          {saved && (
            <p className="success-message" role="status">
              <LocalizedText text="Your learning space is updated." />
            </p>
          )}
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <button
              className="button secondary"
              type="button"
              onClick={async () => {
                await api('/auth/logout', { method: 'POST' });
                router.push('/login');
              }}
            >
              <LogOut size={16} />
              <LocalizedText text="Sign out" />
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
              <LocalizedText text="Save my details" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
