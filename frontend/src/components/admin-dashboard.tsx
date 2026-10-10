'use client';
import Link from 'next/link';
import { Users, BookOpen, Check, Workflow, ArrowUpRight, Zap } from 'lucide-react';
import { useApi, Loading, ErrorState, ProgressBar } from './ui';
export interface AdminMetrics {
  users: { totalUsers: number; activeUsers: number; newUsers: number };
  lessons: { lessonsGenerated: number; lessonsCompleted: number };
  jobs: { total: number; completed: number; failed: number; pending: number };
  usage: { tokens: number; cost: number; unreportedRecords: number; reportedRecords: number };
  growth: { date: string; count: number }[];
  subjects: { name: string; count: number }[];
}
export function AdminDashboard({ reports = false }: { reports?: boolean }) {
  const { data, error, loading, reload } = useApi<AdminMetrics>('/admin/dashboard');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  const success = data.jobs.total
    ? Math.round(((data.jobs.completed || 0) / data.jobs.total) * 100)
    : 0;
  const failed = data.jobs.total
    ? Math.round(((data.jobs.failed || 0) / data.jobs.total) * 100)
    : 0;
  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1>{reports ? 'Learning & generation reports' : 'Platform overview'}</h1>
          <p>
            {reports
              ? 'Live reports across students, lessons and generation activity.'
              : 'A clear view of the curiosity happening across Wonderlab.'}
          </p>
        </div>
        <button className="button secondary" onClick={() => void reload()}>
          Refresh data
        </button>
      </div>
      <div className="admin-stat-grid">
        {[
          {
            label: 'Total users',
            value: data.users.totalUsers,
            detail: (data.users.activeUsers || 0) + ' active in the past 7 days',
            icon: Users,
          },
          {
            label: 'Lessons generated',
            value: data.lessons.lessonsGenerated,
            detail: 'Across all subjects and languages',
            icon: BookOpen,
          },
          {
            label: 'Lessons completed',
            value: data.lessons.lessonsCompleted,
            detail: 'Completed student learning journeys',
            icon: Check,
          },
          {
            label: 'Generation success',
            value: success + '%',
            detail: (data.jobs.pending || 0) + ' pending · ' + failed + '% failed',
            icon: Workflow,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <section className="admin-stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </section>
        ))}
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="section-heading">
            <h2>Subject popularity</h2>
            <Link href="/admin/subjects">
              View subjects <ArrowUpRight size={14} />
            </Link>
          </div>
          <p>Generated lessons by subject</p>
          {data.subjects.map((s) => (
            <div className="admin-chart-row" key={s.name}>
              <div>
                <span>{s.name}</span>
                <strong>{s.count}</strong>
              </div>
              <ProgressBar
                value={
                  data.lessons.lessonsGenerated
                    ? (s.count / data.lessons.lessonsGenerated) * 100
                    : 0
                }
              />
            </div>
          ))}
        </section>
        <section className="admin-panel">
          <h2>Generation health</h2>
          <p>Durable jobs across the platform</p>
          <div className="generation-health">
            <div>
              <span className="status-dot completed" />
              Completed<strong>{data.jobs.completed || 0}</strong>
            </div>
            <div>
              <span className="status-dot pending" />
              Pending or processing<strong>{data.jobs.pending || 0}</strong>
            </div>
            <div>
              <span className="status-dot failed" />
              Failed<strong>{data.jobs.failed || 0}</strong>
            </div>
          </div>
          <Link href="/admin/generation-jobs" className="button secondary">
            Inspect generation jobs
            <ArrowUpRight size={14} />
          </Link>
        </section>
        <section className="admin-panel">
          <h2>User growth</h2>
          <p>New account registrations by day</p>
          <div className="activity-chart">
            {data.growth
              .slice()
              .reverse()
              .map((d) => (
                <div className="activity-bar" key={d.date} title={d.count + ' new users'}>
                  <div
                    style={{
                      height: Math.max(
                        4,
                        (d.count / Math.max(1, ...data.growth.map((r) => r.count))) * 130,
                      ),
                    }}
                  />
                  <span>
                    {new Date(d.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
          </div>
          <div className="admin-growth-note">
            {data.users.newUsers || 0} new users in the past 7 days
          </div>
        </section>
        <section className="admin-panel">
          <h2>AI usage</h2>
          <p>Recorded provider consumption</p>
          <div className="admin-usage-values">
            <div>
              <Zap size={20} />
              <strong>
                {data.usage.unreportedRecords && !data.usage.reportedRecords
                  ? 'Not reported'
                  : Number(data.usage.tokens).toLocaleString()}
              </strong>
              <span>{data.usage.unreportedRecords ? 'Reported tokens' : 'Total tokens'}</span>
            </div>
            <div>
              <strong>
                {data.usage.unreportedRecords && !data.usage.reportedRecords
                  ? 'Not reported'
                  : '$' + Number(data.usage.cost).toFixed(4)}
              </strong>
              <span>
                {data.usage.unreportedRecords ? 'Reported usage cost' : 'Estimated usage cost'}
              </span>
            </div>
          </div>
          <p>
            {data.usage.unreportedRecords
              ? `${data.usage.unreportedRecords} Codex session usage records are not reported and are excluded from these totals.`
              : 'Cost estimates are configurable per provider model.'}
          </p>
          <Link href="/admin/usage" className="text-button">
            View usage records <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
}
