'use client';
import { SoundControls } from './sounds';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Atom,
  LayoutDashboard,
  Users,
  BookOpen,
  Workflow,
  Tags,
  Library,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  FileBarChart,
  Settings,
  ArrowLeft,
  Shield,
  Menu,
  X,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { SessionProvider, useSession } from './session';
import { api } from '@/lib/api';
import { Loading, ErrorState } from './ui';
const nav = [
  ['', 'Dashboard', LayoutDashboard],
  ['users', 'Users', Users],
  ['families', 'Families', Users],
  ['plans', 'Plans', Tags],
  ['subscriptions', 'Subscriptions', CreditCard],
  ['lessons', 'Lessons', BookOpen],
  ['generation-jobs', 'Generation jobs', Workflow],
  ['subjects', 'Subjects', Tags],
  ['content-library', 'Content library', Library],
  ['ai-configuration', 'AI configuration', BrainCircuit],
  ['usage', 'Usage', ChartNoAxesColumnIncreasing],
  ['reports', 'Reports', FileBarChart],
  ['settings', 'System settings', Settings],
] as const;
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') return <>{children}</>;
  return (
    <SessionProvider loginPath="/admin/login">
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  const { user, error, loading, refresh } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={() => void refresh()} />;
  if (!user) return <Loading />;
  if (!user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN'))
    return (
      <div className="admin-denied">
        <Shield size={40} />
        <h1>This space is for administrators.</h1>
        <Link className="button primary" href="/app">
          Back to your learning space
        </Link>
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className={'admin-sidebar ' + (open ? 'open' : '')}>
        <Link href="/admin" className="brand">
          <span className="brand-symbol">
            <Atom size={23} />
          </span>
          wonderlab<span className="brand-dot">.</span>
        </Link>
        <span className="admin-workspace">
          <Shield size={12} />
          Administration
        </span>
        <button
          className="mobile-close icon-button"
          aria-label="Close admin navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <nav>
          {nav.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              href={'/admin' + (slug ? '/' + slug : '')}
              onClick={() => setOpen(false)}
              className={path === '/admin' + (slug ? '/' + slug : '') ? 'active' : ''}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/app">
            <ArrowLeft size={16} />
            Learning portal
          </Link>
          <button
            className="button secondary"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              router.push('/admin/login');
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
          <span className="admin-user">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.roles.join(', ')}</small>
            </div>
          </span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(true)}
            aria-label="Open admin navigation"
            aria-expanded={open}
          >
            <Menu />
          </button>
          <span>
            Wonderlab workspace <span>/</span> <strong>Administration</strong>
          </span>
          <SoundControls />
          <span className="admin-secure">
            <Shield size={13} />
            Authenticated admin session
          </span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
