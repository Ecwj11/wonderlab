'use client';
import { SoundControls } from './sounds';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Atom,
  LayoutDashboard,
  Users,
  CreditCard,
  LogOut,
  ExternalLink,
  Gift,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { SessionProvider, useSession } from './session';
import { I18nProvider, LanguageSelector, LocalizedText, useI18n } from './i18n';
import { Loading, ErrorState } from './ui';
import { api } from '@/lib/api';
export function ParentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/parent/login') return <>{children}</>;
  return (
    <SessionProvider loginPath="/parent/login">
      <I18nProvider>
        <Shell>{children}</Shell>
      </I18nProvider>
    </SessionProvider>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  const { user, error, loading, refresh } = useSession();
  const { language } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading || (!user && !error)) return <Loading />;
  if (error) return <ErrorState message={error} retry={() => void refresh()} />;
  if (!user?.roles.includes('PARENT'))
    return <ErrorState message="This space is for parents. Sign in with your parent account." />;
  const logout = async () => {
    setBusy(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      router.replace('/parent/login');
      router.refresh();
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : 'Unable to sign out.');
      setBusy(false);
    }
  };
  return (
    <div
      className="family-shell"
      data-ui-language={language}
      lang={language === 'zh' ? 'zh-Hans' : 'en'}
    >
      <header className="family-topbar">
        <Link href="/parent" className="brand">
          <span className="brand-symbol">
            <Atom size={24} />
          </span>
          wonderlab<span className="brand-dot">.</span>
        </Link>
        <div className="family-topbar-actions">
          <SoundControls />
          <LanguageSelector />
          <span className="family-parent-name">{user.name}</span>
          <button
            type="button"
            className="family-quiet"
            onClick={() => void logout()}
            disabled={busy}
          >
            <LogOut size={16} />
            <LocalizedText text="Sign out" />
          </button>
        </div>
      </header>
      <div className="family-workspace">
        <aside className="family-sidebar">
          <p>
            <LocalizedText text="Your family space" />
          </p>
          <nav aria-label="Family navigation">
            {[
              ['/parent', 'Dashboard', LayoutDashboard],
              ['/parent/children', 'Children', Users],
              ['/parent/create', 'Create a lesson', Sparkles],
              ['/parent/lessons', 'Family lessons', BookOpen],
              ['/parent/rewards', 'Family prizes', Gift],
              ['/parent/billing', 'Subscription', CreditCard],
            ].map(([href, label, Icon]) => {
              const NavIcon = Icon as typeof Users;
              return (
                <Link
                  key={String(href)}
                  href={String(href)}
                  className={pathname === href ? 'active' : ''}
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  <NavIcon size={19} />
                  <LocalizedText text={String(label)} />
                </Link>
              );
            })}
          </nav>
          <Link className="family-child-link" href="/child/login">
            <ExternalLink size={16} />
            <LocalizedText text="Open child login" />
          </Link>
          <div className="family-sidebar-note">
            <span aria-hidden="true">🌱</span>
            <p>
              <LocalizedText text="Small steps. Growing minds." />
            </p>
          </div>
        </aside>
        <main className="family-main">
          {logoutError && (
            <p role="alert" className="family-error">
              {logoutError}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
