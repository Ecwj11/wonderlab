'use client';
import { LocalizedText } from '@/components/i18n';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Zap,
  BookOpen,
  Clock,
  ChevronRight,
  Check,
  Plus,
  Heart,
  Calculator,
  FlaskConical,
  Landmark,
  Globe,
  Lightbulb,
  Trophy,
} from 'lucide-react';
import {
  canCreateLessons,
  lessonCreationPath,
  subjectLabels,
  type DashboardData,
} from '@wonderlab/shared';
import { useApi, Loading, ErrorState, ProgressBar } from '@/components/ui';
import { LessonArt, Mascot } from '@/components/art';
import Image from 'next/image';
import { usePortalAppearance } from '@/components/portal-appearance';
import { portalTemplates } from '@/lib/templates';
import { LessonCard } from '@/components/lesson-card';
export default function Dashboard() {
  const { template } = usePortalAppearance();
  const design = portalTemplates[template];
  const { data, error, loading, reload } = useApi<DashboardData>('/dashboard');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  const { user, stats, recent, recommended } = data;
  const canCreate = canCreateLessons(user);
  const createPath = lessonCreationPath(user);
  const explorePath = canCreate ? createPath : '/app/lessons';
  const continuing = data.continueLearning;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      active: stats.activity.some((a) => a.date === d.toLocaleDateString('en-CA')),
      today: i === 6,
    };
  });
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="greeting">
            <LocalizedText text="Your adventure starts here" />
            <span className="little-sun">☀</span>
          </div>
          <h1>
            <LocalizedText text={`Hey, ${user.name.split(' ')[0]}!`} />{' '}
            <span className="hello-wave">✦</span>
          </h1>
          <p>
            <LocalizedText text="What will you discover today?" />
          </p>
        </div>
        {canCreate && (
          <Link href={createPath} className="button primary">
            <Plus size={18} />
            <LocalizedText text="Create a lesson" />
          </Link>
        )}
      </div>
      <section className="dashboard-hero kids-hero">
        <div className="hero-copy">
          <span className="club-badge">
            <Sparkles size={17} /> <LocalizedText text={design.badge} />
          </span>
          <h2>
            <LocalizedText text={design.heroTitle[0]} /> <br />
            <LocalizedText text={design.heroTitle[1]} />
          </h2>
          <p>
            <LocalizedText text={design.heroDescription} />
          </p>
          <div className="hero-cta-row">
            <Link href={explorePath} className="button hero-button">
              <Sparkles size={20} />
              <LocalizedText text={canCreate ? 'Let’s make a lesson' : 'Let’s play a lesson'} />
              <ArrowRight size={20} />
            </Link>
            <Link className="hero-library-link" href="/app/library">
              <LocalizedText text="Explore the library" />
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <span className="hero-footnote">
            <LocalizedText text="Don’t just read it. Experience it." />
          </span>
        </div>
        <div className="playground-picture">
          <Image
            className="template-hero-art"
            src={design.heroAsset}
            alt=""
            width={640}
            height={640}
            sizes="(max-width: 600px) 300px, (max-width: 1000px) 240px, 520px"
            priority
          />
          <span className="mascot-speech">
            <LocalizedText text={design.speech} />
          </span>
        </div>
      </section>
      <div className="stats-row">
        {[
          {
            icon: Zap,
            label: 'Your XP',
            value: stats.xp.toLocaleString(),
            suffix: 'XP',
            tint: 'lavender',
            note: 'Every discovery counts',
          },
          {
            icon: Flame,
            label: 'Day streak',
            value: String(stats.streak),
            suffix: stats.streak === 1 ? 'day' : 'days',
            tint: 'peach',
            note: stats.streak ? 'Keep your spark alive' : 'Let’s start your first streak',
          },
          {
            icon: BookOpen,
            label: 'Adventures finished',
            value: String(stats.completed),
            suffix: '',
            tint: 'mint',
            note: 'Little steps, big discoveries',
          },
          {
            icon: Clock,
            label: 'Learning time',
            value: String(stats.learningMinutes),
            suffix: 'min',
            tint: 'blue',
            note: 'Invested in your curiosity',
          },
        ].map(({ icon: Icon, label, value, suffix, tint, note }) => (
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
              <span className="stat-note">
                <LocalizedText text={note} />
              </span>
            </div>
          </div>
        ))}
      </div>
      <section className="worlds-section">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText text="Pick a world to explore" />
            </h2>
            <p>
              <LocalizedText text="Where will your curiosity take you?" />
            </p>
          </div>
          <span className="worlds-note">
            <Trophy size={18} />
            <LocalizedText text="Your next big discovery" />
          </span>
        </div>
        <div className="subject-worlds">
          {[
            {
              subject: 'MATHEMATICS',
              label: 'Maths',
              caption: 'Slice, count & solve',
              Icon: Calculator,
              tint: 'coral',
            },
            {
              subject: 'SCIENCE',
              label: 'Science',
              caption: 'See how things work',
              Icon: FlaskConical,
              tint: 'mint',
            },
            {
              subject: 'HISTORY',
              label: 'History',
              caption: 'Travel back in time',
              Icon: Landmark,
              tint: 'peach',
            },
            {
              subject: 'GEOGRAPHY',
              label: 'Geography',
              caption: 'Explore our planet',
              Icon: Globe,
              tint: 'blue',
            },
            {
              subject: 'GENERAL',
              label: 'Anything!',
              caption: 'Follow a big question',
              Icon: Lightbulb,
              tint: 'lavender',
            },
          ].map(({ subject, label, caption, Icon, tint }) => (
            <Link
              href={'/app/library?subject=' + subject}
              className={'subject-world ' + tint}
              data-subject={subject}
              key={subject}
            >
              <span className="world-icon">
                <Icon size={31} strokeWidth={2.3} />
              </span>
              <strong>
                <LocalizedText text={label} />
              </strong>
              <small>
                <LocalizedText text={caption} />
              </small>
              <ArrowUpRight className="world-arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-middle">
        <section className="continue-section">
          <div className="section-heading">
            <h2>
              <LocalizedText text="Keep your adventure going" />
            </h2>
            <Link href="/app/lessons">
              <LocalizedText text="My lessons" />
              <ChevronRight size={15} />
            </Link>
          </div>
          {continuing ? (
            <article className="continue-card">
              <div className="continue-art">
                <LessonArt kind={continuing.title} />
              </div>
              <div className="continue-copy">
                <span className="subject-tag mint">
                  <Heart size={15} />
                  <LocalizedText text={subjectLabels[continuing.subject]} />
                </span>
                <h3>{continuing.title}</h3>
                <p>
                  <LocalizedText text="You’ve already made a great start. Let’s discover the rest!" />
                </p>
                <div className="continue-progress">
                  <ProgressBar value={continuing.progress} />
                  <span>{continuing.progress}%</span>
                </div>
                <Link className="button continue-button" href={'/app/lesson/' + continuing.id}>
                  <LocalizedText text="Continue learning" />
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ) : (
            <article className="continue-card">
              <div className="continue-art">
                <Mascot />
              </div>
              <div className="continue-copy">
                <span className="subject-tag mint">
                  <LocalizedText text="Your next discovery" />
                </span>
                <h3>
                  <LocalizedText text="Every adventure starts somewhere." />
                </h3>
                <p>
                  <LocalizedText
                    text={
                      canCreate
                        ? 'Pick a topic you’re curious about. We’ll bring it to life.'
                        : 'Your parent prepares new adventures. Explore a lesson from the library while you wait.'
                    }
                  />
                </p>
                <Link
                  className="button continue-button"
                  href={canCreate ? createPath : '/app/library'}
                >
                  <LocalizedText text="Start exploring" />
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          )}
        </section>
        <section className="streak-section">
          <div className="section-heading">
            <h2>
              <LocalizedText text="Your daily quest" />
            </h2>
            <Flame size={18} />
          </div>
          <div className="daily-card">
            <div className="daily-top">
              <span className="daily-flame">
                <Flame size={28} fill="currentColor" />
              </span>
              <div>
                <h3>
                  <LocalizedText
                    text={
                      stats.streak
                        ? stats.streak + (stats.streak === 1 ? ' day' : ' days') + ' of discovery'
                        : 'Let’s build a little habit'
                    }
                  />
                </h3>
                <p>
                  <LocalizedText
                    text={
                      stats.streak
                        ? 'You’re keeping your curiosity alive.'
                        : 'One small discovery can make your day.'
                    }
                  />
                </p>
              </div>
            </div>
            <div className="week-days">
              {days.map((d, i) => (
                <div className={d.today ? 'today' : ''} key={i}>
                  <span>
                    <LocalizedText text={d.label} />
                  </span>
                  <span className={'day-circle ' + (d.active ? 'done' : '')}>
                    {d.active ? <Check size={16} /> : d.today ? <span className="today-dot" /> : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="daily-footer">
              <span>
                <LocalizedText text="Daily goal" />
              </span>
              <strong>
                {Math.min(stats.learningTodayMinutes, data.dailyGoalMinutes)} /{' '}
                {data.dailyGoalMinutes}
                <LocalizedText text="min" />
              </strong>
            </div>
            <ProgressBar
              className="sunshine"
              value={Math.min(100, (stats.learningTodayMinutes / data.dailyGoalMinutes) * 100)}
            />
            <p className="daily-encouragement">
              <LocalizedText text="A little today. A little wiser tomorrow." />
            </p>
          </div>
        </section>
      </div>
      <section className="recommended-section">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText text="Ready-to-play adventures" />
            </h2>
            <p>
              <LocalizedText text="Big discoveries, picked just for you." />
            </p>
          </div>
          <Link href="/app/library">
            <LocalizedText text="Explore the library" />
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="lesson-grid">
          {recommended.slice(0, 4).map((l) => (
            <LessonCard key={l.id} lesson={l} library />
          ))}
        </div>
      </section>
      {recent.length > 0 && (
        <section className="recommended-section recent-section">
          <div className="section-heading">
            <div>
              <h2>
                <LocalizedText text="Your newest adventures" />
              </h2>
              <p>
                <LocalizedText text="Your recently created adventures, ready when you are." />
              </p>
            </div>
            <Link href="/app/lessons">
              <LocalizedText text="All my lessons" />
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="lesson-grid">
            {recent.slice(0, 4).map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} onChange={() => void reload()} />
            ))}
          </div>
        </section>
      )}
      <section className="dashboard-subjects">
        <div className="section-heading">
          <h2>
            <LocalizedText text="Every subject, a little clearer" />
          </h2>
          <Link href="/app/progress">
            <LocalizedText text="My progress" />
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="dashboard-subject-grid">
          {stats.subjectProgress.map((subject) => (
            <Link
              href={'/app/library?subject=' + subject.subject}
              className="panel"
              key={subject.subject}
            >
              <strong>
                <LocalizedText text={subjectLabels[subject.subject]} />
              </strong>
              <span>
                {subject.completed} <LocalizedText text="discoveries completed" />
              </span>
              <ProgressBar value={subject.percentage} />
              <small>
                {subject.percentage}
                <LocalizedText text="% of your lessons" />
              </small>
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-bottom-note">
        <Sparkles size={17} />
        <span>
          <LocalizedText text="Big discoveries start with small questions. What will you wonder about next?" />
        </span>
        <Link href={explorePath}>
          <LocalizedText text="Find out" />
          <ArrowRight size={15} />
        </Link>
      </div>
      {data.provider === 'mock' && (
        <div className="demo-note">
          <LocalizedText text="You’re exploring Wonderlab’s demo studio. Try fractions, the human heart or Malaysia independence." />
        </div>
      )}
    </div>
  );
}
