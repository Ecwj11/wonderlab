'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Atom, ArrowRight, Eye, EyeOff, LoaderCircle, Shield, Users, Gamepad2 } from 'lucide-react';
import { api } from '@/lib/api';
import { WonderArt } from './art';
import { SoundControls } from './sounds';
import { MusicControls } from './music';

type Portal = 'admin' | 'parent' | 'child';
const portals = [
  ['parent', 'Parent', Users],
  ['child', 'Child', Gamepad2],
  ['admin', 'Admin', Shield],
] as const;
export function PortalLogin({ portal }: { portal: Portal }) {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const child = portal === 'child';
  const title = child
    ? 'Your adventure is waiting.'
    : portal === 'admin'
      ? 'Manage the learning world.'
      : 'A little learning. A big future.';
  return (
    <div className={'login-page portal-login portal-' + portal}>
      <section className="login-world">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Atom size={24} />
          </span>
          wonderlab<span className="brand-dot">.</span>
        </Link>
        <div className="login-world-copy">
          <h1>{title}</h1>
          <p>
            {child
              ? 'Find your family. Pick up where you left off. Let’s play!'
              : portal === 'admin'
                ? 'Support families, set trials and manage subscriptions.'
                : 'One family space. Every child’s own adventure.'}
          </p>
          <WonderArt className="login-art" />
        </div>
        <span className="login-copyright">Don’t just read it. Experience it.</span>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <nav className="portal-tabs" aria-label="Choose a sign-in portal">
            {portals.map(([key, label, Icon]) => (
              <Link
                key={key}
                href={'/' + key + '/login'}
                aria-current={portal === key ? 'page' : undefined}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
          <h2>
            {register
              ? 'Create your family space'
              : child
                ? 'Hello, explorer!'
                : portal === 'admin'
                  ? 'Admin sign in'
                  : 'Parent sign in'}
          </h2>
          <p>
            {child
              ? 'Ask your parent for your family code and passcode.'
              : register
                ? 'Manage your children and their learning in one place.'
                : 'Welcome back to your Wonderlab space.'}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              const fields = Object.fromEntries(new FormData(event.currentTarget));
              try {
                await api('/auth/' + portal + '/' + (register ? 'register' : 'login'), {
                  method: 'POST',
                  body: JSON.stringify(fields),
                });
                router.push(
                  portal === 'admin' ? '/admin' : portal === 'parent' ? '/parent' : '/app',
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to sign in.');
                setBusy(false);
              }
            }}
          >
            {register && (
              <>
                <label>
                  Your name
                  <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
                </label>
                <label>
                  Family name
                  <input
                    name="familyName"
                    placeholder="The Tan family"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              </>
            )}
            {child ? (
              <>
                <label>
                  Family code
                  <input
                    name="familyCode"
                    placeholder="e.g. WONDER01"
                    autoComplete="off"
                    required
                    maxLength={16}
                    className="family-code-input"
                  />
                </label>
                <label>
                  Your username
                  <input
                    name="username"
                    placeholder="e.g. alex"
                    autoComplete="username"
                    required
                    maxLength={32}
                    autoCapitalize="none"
                  />
                </label>
              </>
            ) : (
              <label>
                Email address
                <input name="email" type="email" autoComplete="email" required maxLength={254} />
              </label>
            )}
            <label>
              {child ? 'Passcode' : 'Password'}
              <div className="password-field">
                <input
                  name={child ? 'passcode' : 'password'}
                  type={show ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 10 : child ? 6 : 1}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy && <LoaderCircle size={17} className="spin" />}
              {register ? 'Create family account' : child ? 'Let’s play' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {portal === 'parent' && (
            <p className="login-switch">
              {register ? 'Already have a family space?' : 'New family?'}{' '}
              <button
                onClick={() => {
                  setRegister(!register);
                  setError('');
                }}
              >
                {register ? 'Sign in' : 'Create a family account'}
              </button>
            </p>
          )}
          <Link href="/login" className="portal-legacy">
            Student or teacher account? Sign in here
          </Link>
          <div className="login-footer">
            {child ? 'Your progress and rewards belong to you.' : 'Learning grows together.'}
          </div>
          {child && (
            <div className="child-login-music">
              <MusicControls />
              <SoundControls />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
