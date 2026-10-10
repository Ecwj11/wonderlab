'use client';
import { canCreateLessons, lessonCreationPath } from '@wonderlab/shared';
import { LocalizedText, useI18n, I18nProvider, LanguageSelector } from '@/components/i18n';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutGrid,
  Compass,
  BookOpen,
  Library,
  Flag,
  ChartNoAxesColumnIncreasing,
  Trophy,
  UserRound,
  Sparkles,
  Flame,
  Zap,
  ChevronDown,
  Search,
  Bell,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
  CircleHelp,
  Atom,
  Gift,
  Star,
} from 'lucide-react';
import { SessionProvider, useSession } from './session';
import { Loading, ErrorState, ProgressBar, Modal, useApi } from './ui';
import { Mascot } from './art';
import { api } from '@/lib/api';
import type { ProgressStats, StarWallet } from '@wonderlab/shared';
import { PortalAppearanceProvider, usePortalAppearance } from './portal-appearance';
import { FamilyLearningGuard } from './family-learning-guard';
import { portalTemplates } from '@/lib/templates';
import { SoundControls } from './sounds';
import { MusicControls } from './music';
const navigation = [
  ['/app', 'Dashboard', LayoutGrid],
  ['/app/create', 'Learn', Compass],
  ['/app/lessons', 'My lessons', BookOpen],
  ['/app/library', 'Library', Library],
  ['/app/challenges', 'Challenges', Flag],
  ['/app/progress', 'Progress', ChartNoAxesColumnIncreasing],
  ['/app/achievements', 'Achievements', Trophy],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <PortalAppearanceProvider>
          <Shell>{children}</Shell>
        </PortalAppearanceProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  const { t, language } = useI18n();

  const { user, loading, error, refresh } = useSession();
  const appearance = usePortalAppearance();
  const { data: stats } = useApi<ProgressStats>('/progress');
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState('');
  const [starBalance, setStarBalance] = useState<number | null>(null);
  const childAccountId = user?.accountType === 'CHILD' && user.familyId ? user.id : null;
  useEffect(() => {
    if (!childAccountId) {
      setStarBalance(null);
      return;
    }
    let alive = true;
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        const wallet = await api<StarWallet>('/rewards/wallet');
        if (alive && request === version) setStarBalance(wallet.balance);
      } catch {
        if (alive && request === version) setStarBalance(null);
      }
    };
    void load();
    window.addEventListener('wonderlab:stars-changed', load);
    return () => {
      alive = false;
      window.removeEventListener('wonderlab:stars-changed', load);
    };
  }, [childAccountId, pathname]);
  const baseNavigation = navigation.filter(
    ([url]) => url !== '/app/create' || canCreateLessons(user),
  );
  const visibleNavigation = childAccountId
    ? [...baseNavigation, ['/app/rewards', 'Rewards', Gift] as const]
    : baseNavigation;
  const active = visibleNavigation.find(([url]) =>
    url === '/app' ? pathname === url : pathname.startsWith(url),
  );
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={() => void refresh()} />;
  if (!user) return <Loading label="Opening the sign-in page…" />;
  if (appearance.loading) return <Loading label="Opening your learning world…" />;
  if (appearance.error)
    return <ErrorState message={appearance.error} retry={() => void appearance.reload()} />;
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
  return (
    <div
      className="app-shell"
      data-template={appearance.template}
      data-ui-language={language}
      lang={language === 'zh' ? 'zh-Hans' : 'en'}
    >
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <Link href="/app" className="brand">
          <span className="brand-symbol">
            <Atom size={24} />
          </span>
          wonderlab<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label={t('Close navigation')}
          aria-expanded={mobile}
        >
          <X />
        </button>
        <div className="workspace-label">
          <LocalizedText text="Your adventure club" />
        </div>
        <nav>
          {visibleNavigation.map(([url, label, Icon]) => (
            <Link
              href={url === '/app/create' ? lessonCreationPath(user) : url}
              key={url}
              className={'nav-item ' + (active?.[0] === url ? 'active' : '')}
              onClick={() => setMobile(false)}
            >
              <Icon size={19} strokeWidth={2.5} />
              <span>
                <LocalizedText text={label} />
              </span>
              {url === '/app/create' && (
                <span className="nav-new">
                  <LocalizedText text="New" />
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-divider" />
        {user.accountType === 'PARENT' && (
          <Link className="nav-item" href="/parent">
            <UserRound size={19} />
            <LocalizedText text="Family space" />
          </Link>
        )}
        <div className="workspace-label">
          <LocalizedText text="Pick a world" />
        </div>
        <div className="subject-nav">
          {[
            ['Mathematics', 'MATHEMATICS', 'coral'],
            ['Science', 'SCIENCE', 'mint'],
            ['History', 'HISTORY', 'peach'],
            ['Geography', 'GEOGRAPHY', 'blue'],
          ].map(([label, value, color]) => (
            <Link key={value} href={'/app/library?subject=' + value}>
              <span className={'subject-dot ' + color} />
              <LocalizedText text={label} />
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="curiosity-card">
            <Mascot />
            <div>
              <strong>
                <LocalizedText text="A little curious?" />
                <br />
                <LocalizedText text="Let’s play and learn!" />
              </strong>
              <Link href={canCreateLessons(user) ? lessonCreationPath(user) : '/app/library'}>
                <LocalizedText text="Let’s explore" />
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            <LocalizedText text="Need a hand?" />
          </button>
          <Link
            className={'nav-item ' + (pathname === '/app/profile' ? 'active' : '')}
            href="/app/profile"
          >
            <UserRound size={19} />
            <LocalizedText text="My profile" />
          </Link>
          {childAccountId && (
            <Link
              href="/app/rewards"
              className="stars-nav-balance"
              data-testid="stars-balance-link"
              onClick={() => setMobile(false)}
            >
              <Star size={18} fill="currentColor" />
              <span>
                {starBalance === null ? (
                  <LocalizedText text="My Stars" />
                ) : (
                  <LocalizedText text={`${starBalance.toLocaleString()} Stars`} />
                )}
              </span>
            </Link>
          )}
          <button className="profile-mini" onClick={() => router.push('/app/profile')}>
            <span className="avatar">{initials}</span>
            <div>
              <strong>{user.name}</strong>
              <span>
                <LocalizedText text={`Level ${user.level} · Explorer`} />
              </span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label={t('Open navigation')}
              aria-expanded={mobile}
            >
              <Menu />
            </button>
            <span>
              <LocalizedText text="Your adventure club" />
            </span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              <LocalizedText text={active?.[1] || 'Lesson adventure'} />
            </strong>
          </div>
          <div className="topbar-actions">
            <MusicControls />
            <SoundControls />
            <LanguageSelector />
            <form
              className="top-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push('/app/lessons?search=' + encodeURIComponent(search));
              }}
            >
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Find a lesson…')}
                aria-label={t('Find a lesson')}
              />
              <kbd>↵</kbd>
            </form>
            <span className="top-stat streak">
              <Flame size={19} fill="currentColor" />
              {stats?.streak || 0}
            </span>
            <span className="top-stat xp">
              <Zap size={18} fill="currentColor" />
              {user.xp.toLocaleString()} <small>XP</small>
            </span>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label={t('Learning notifications')}
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={20} />
              </button>
              {notifications && (
                <div className="notification-popover">
                  <strong>
                    <LocalizedText text="A fresh start awaits ✦" />
                  </strong>
                  <p>
                    <LocalizedText
                      text={
                        canCreateLessons(user)
                          ? 'Your learning adventures are ready. Create a lesson or continue where you left off.'
                          : 'Your learning adventures are ready. Choose a lesson and start playing.'
                      }
                    />
                  </p>
                  <Link href="/app/lessons" onClick={() => setNotifications(false)}>
                    <LocalizedText text="Explore my lessons" />
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <Link href="/app/profile" className="avatar top-avatar" aria-label={t('Your profile')}>
              {initials}
            </Link>
          </div>
        </header>
        <main className="page-content">
          {appearance.preview && (
            <div className="template-preview-notice" role="status">
              <span>
                <LocalizedText
                  text={`Previewing ${portalTemplates[appearance.template].name}. Only you see this preview.`}
                />
              </span>
              <Link href="/admin/settings">
                <LocalizedText text="Back to template settings" />
                <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
          <FamilyLearningGuard>{children}</FamilyLearningGuard>
        </main>
        <footer className="app-footer">
          <span>
            <LocalizedText text="A little curiosity goes a long way." />
          </span>
          <span>
            <LocalizedText text="Made for the way you learn" />
            <Sparkles size={13} />
          </span>
        </footer>
      </div>
      {help && (
        <Modal title={'Welcome to your wonderlab'} onClose={() => setHelp(false)}>
          <div className="help-content">
            <p>
              <LocalizedText text="Turn a little curiosity into a big discovery." />
            </p>
            <ol>
              <li>
                <strong>
                  <LocalizedText
                    text={canCreateLessons(user) ? 'Create a lesson.' : 'Choose a lesson.'}
                  />
                </strong>
                <LocalizedText
                  text={
                    canCreateLessons(user)
                      ? 'Paste textbook text, enter a topic or upload a PDF or image.'
                      : 'Your parent prepares lessons for you. Find them in My lessons or explore the library.'
                  }
                />
              </li>
              <li>
                <strong>
                  <LocalizedText text="Explore your way." />
                </strong>
                <LocalizedText text="Click, slice, flip and discover. Complete each activity before continuing." />
              </li>
              <li>
                <strong>
                  <LocalizedText text="Make it stick." />
                </strong>
                <LocalizedText text="Answer the quiz and earn XP. Your progress is saved automatically." />
              </li>
            </ol>
            <p>
              <LocalizedText text="Bring a topic you're curious about. Explore the activities and follow the hints as you learn." />
            </p>
            <div className="level-preview">
              <Zap size={20} />
              <span>
                <LocalizedText text={`Level ${user.level}`} />
              </span>
              <ProgressBar value={(user.xp % 500) / 5} />
              <span>{user.xp % 500}/500 XP</span>
            </div>
            <button
              className="button secondary"
              onClick={async () => {
                await api('/auth/logout', { method: 'POST' });
                router.push(
                  user.accountType === 'CHILD'
                    ? '/child/login'
                    : user.accountType === 'PARENT'
                      ? '/parent/login'
                      : '/login',
                );
              }}
            >
              <LogOut size={16} />
              <LocalizedText text="Sign out" />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
