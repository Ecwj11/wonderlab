'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { Sparkles, Zap, Flame, BookOpen, Target, Clock, Trophy } from 'lucide-react';
import { type ProgressStats, subjectLabels } from '@wonderlab/shared';
import { useApi, Loading, ErrorState, ProgressBar } from '@/components/ui';
export default function Progress() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<ProgressStats>('/progress');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const key = date.toLocaleDateString('en-CA');
    return {
      date: date.toLocaleDateString('en', { weekday: 'short' }),
      xp: data.activity.find((a) => a.date === key)?.xp || 0,
    };
  });
  const max = Math.max(100, ...days.map((d) => d.xp));
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Sparkles size={14} />
            <LocalizedText text="Look how far your curiosity has taken you" />
          </div>
          <h1>
            <LocalizedText text="A little progress. Every day." />
          </h1>
          <p>
            <LocalizedText text="Every question, every discovery, every “aha!” adds up." />
          </p>
        </div>
      </div>
      <div className="stats-row">
        {[
          {
            icon: BookOpen,
            label: 'Completed adventures',
            value: data.completed,
            suffix: '',
            tint: 'mint',
          },
          {
            icon: Target,
            label: 'Average quiz score',
            value: data.averageScore,
            suffix: '%',
            tint: 'lavender',
          },
          {
            icon: Clock,
            label: 'Time spent exploring',
            value: data.learningMinutes,
            suffix: 'min',
            tint: 'blue',
          },
          {
            icon: Flame,
            label: 'Longest learning streak',
            value: data.longestStreak,
            suffix: 'days',
            tint: 'peach',
          },
        ].map(({ icon: Icon, label, value, suffix, tint }) => (
          <div className="stat-card" key={label}>
            <span className={'stat-icon ' + tint}>
              <Icon size={20} />
            </span>
            <div>
              <span className="stat-label">
                <LocalizedText text={label} />
              </span>
              <div className="stat-value">
                {value}
                <small>
                  <LocalizedText text={suffix} />
                </small>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="progress-layout">
        <section className="panel">
          <h2>
            <LocalizedText text="Your world of learning" />
          </h2>
          <p>
            <LocalizedText text="A little more confident in every subject." />
          </p>
          {data.subjectProgress.map((s) => (
            <div className="subject-progress-row" key={s.subject}>
              <div>
                <span>
                  <LocalizedText text={subjectLabels[s.subject]} />
                </span>
                <strong>{s.percentage}%</strong>
              </div>
              <ProgressBar value={s.percentage} />
              <small>
                <LocalizedText text={`${s.completed} of ${s.total} lessons completed`} />
              </small>
            </div>
          ))}
        </section>
        <div>
          <section className="panel level-panel">
            <h2>
              <LocalizedText text="Your curiosity has a level" />
            </h2>
            <div className="level-big">
              <Zap />
              <div>
                <strong>
                  <LocalizedText text={`Level ${data.level}`} />
                </strong>
                <span>
                  <LocalizedText
                    text={
                      data.level === 1
                        ? 'A fresh spark of curiosity'
                        : data.level < 5
                          ? 'Curious explorer'
                          : 'Wonder seeker'
                    }
                  />
                </span>
              </div>
            </div>
            <ProgressBar value={(data.xp % 500) / 5} />
            <div className="level-caption">
              <span>{data.xp % 500} / 500 XP</span>
              <span>
                <LocalizedText text={`${500 - (data.xp % 500)} XP to level ${data.level + 1}`} />
              </span>
            </div>
          </section>
          <section className="panel" style={{ marginTop: 21 }}>
            <h2>
              <LocalizedText text="A week of discovery" />
            </h2>
            <p>
              <LocalizedText text="XP earned through your explorations." />
            </p>
            <div
              className="activity-chart"
              role="img"
              aria-label={t(
                'XP earned this week: ' + days.map((d) => t(d.date) + ' ' + d.xp).join(', '),
              )}
            >
              {days.map((d, i) => (
                <div className="activity-bar" key={i} title={d.xp + ' XP'}>
                  <div style={{ height: Math.max(2, (d.xp / max) * 145) }} />
                  <span>
                    <LocalizedText text={d.date} />
                  </span>
                </div>
              ))}
            </div>
            <p className="chart-axis-note">
              <LocalizedText
                text={
                  days.some((d) => d.xp)
                    ? 'Every little discovery is worth celebrating.'
                    : 'Your first adventure will light up this chart.'
                }
              />
            </p>
          </section>
        </div>
      </div>
      <div className="dashboard-bottom-note">
        <Trophy size={17} />
        <span>
          <LocalizedText
            text={`${data.xp.toLocaleString()} XP. ${data.completed} completed adventures. And so much more to discover.`}
          />
        </span>
      </div>
    </div>
  );
}
