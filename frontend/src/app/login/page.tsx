'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Atom, ArrowRight, Sparkles, Eye, EyeOff, LoaderCircle, Check } from 'lucide-react';
import type { User } from '@wonderlab/shared';
import { api } from '@/lib/api';
import { WonderArt } from '@/components/art';
export default function Login() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (demo?: 'student' | 'teacher' | 'admin') => {
    setBusy(true);
    setError('');
    try {
      const { user } = await api<{ user: User }>(
        '/auth/' + (register && !demo ? 'register' : 'login'),
        {
          method: 'POST',
          body: JSON.stringify(
            demo
              ? { email: demo + '@example.com', password: 'qwer1234!' }
              : register
                ? { name, email, password }
                : { email, password },
          ),
        },
      );
      router.push(
        user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
          ? '/admin'
          : user.roles.includes('PARENT')
            ? '/parent'
            : '/app',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-world">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Atom size={24} />
          </span>
          wonderlab<span className="brand-dot">.</span>
        </Link>
        <div className="login-world-copy">
          <span className="hero-kicker">
            <Sparkles size={16} />
            For the wonderfully curious
          </span>
          <h1>
            Don’t just read it.
            <br />
            Experience it.
          </h1>
          <p>
            Big ideas. Little discoveries.
            <br />A whole new world of learning.
          </p>
          <WonderArt className="login-art" />
          <div className="login-features">
            <span>
              <Check size={15} />
              Explore your way
            </span>
            <span>
              <Check size={15} />
              Make it click
            </span>
            <span>
              <Check size={15} />
              Grow a little every day
            </span>
          </div>
        </div>
        <span className="login-copyright">A little curiosity goes a long way.</span>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <nav className="portal-tabs" aria-label="Family sign-in">
            <Link href="/parent/login">Parent</Link>
            <Link href="/child/login">Child</Link>
            <Link href="/admin/login">Admin</Link>
          </nav>
          <span className="login-spark">✦</span>
          <h2>{register ? 'Your adventure starts here.' : 'Welcome, curious mind.'}</h2>
          <p>
            {register
              ? 'Create your space to discover something new.'
              : 'Ready for your next “aha!” moment?'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {register && (
              <label>
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={register ? 'At least 10 characters' : 'Your password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={register ? 10 : 1}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
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
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {register ? 'Create my account' : 'Let’s explore'}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-switch">
            {register ? 'Already have a learning space?' : 'New to Wonderlab?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <div className="demo-login">
              <div className="or-divider">
                <span>Take a little test flight</span>
              </div>
              <button
                className="button demo-button"
                onClick={() => void submit('student')}
                disabled={busy}
              >
                <Sparkles size={17} />
                Try the student demo
                <ArrowRight size={16} />
              </button>
              <div className="demo-other">
                <button onClick={() => void submit('teacher')} disabled={busy}>
                  Teacher demo
                </button>
                <span>·</span>
                <button onClick={() => void submit('admin')} disabled={busy}>
                  Admin demo
                </button>
              </div>
            </div>
          )}
          <div className="login-footer">Learning feels better when it feels like you.</div>
        </div>
      </section>
    </div>
  );
}
