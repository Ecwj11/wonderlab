'use client';
import { LocalizedText } from '@/components/i18n';
import Link from 'next/link';
import { Flag, Sparkles, ArrowRight, Star, Flame, Compass } from 'lucide-react';
import type { ProgressStats } from '@wonderlab/shared';
import { useApi, Loading, ErrorState, ProgressBar } from '@/components/ui';
export default function Challenges() {
  const { data, error, loading, reload } = useApi<ProgressStats>('/progress');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Flag size={14} />
            <LocalizedText text="A little challenge for your curiosity" />
          </div>
          <h1>
            <LocalizedText text="Ready to surprise yourself?" />
          </h1>
          <p>
            <LocalizedText text="Try something new. Make a little progress. Collect a little spark." />
          </p>
        </div>
      </div>
      <section className="challenge-card">
        <Star />
        <div>
          <span className="subject-tag peach">
            <LocalizedText text="Your next little challenge" />
          </span>
          <h2 style={{ marginTop: 13 }}>
            <LocalizedText text="Can you take the perfect slice?" />
          </h2>
          <p>
            <LocalizedText text="Discover fractions with a pizza you can actually slice. Find one quarter, then put your new skills to the test." />
          </p>
          <Link href="/app/library?subject=MATHEMATICS" className="button primary">
            <Sparkles size={16} />
            <LocalizedText text="Take the fraction challenge" />
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <div className="progress-layout">
        <section className="panel">
          <span className="panel-kicker">
            <Compass size={18} />
            <LocalizedText text="Your first big discovery" />
          </span>
          <h2>
            <LocalizedText text="Complete one whole adventure." />
          </h2>
          <p>
            <LocalizedText text="Explore every activity and finish the quiz to unlock your First discovery badge." />
          </p>
          <ProgressBar value={Math.min(100, data.completed * 100)} className="challenge-progress" />
          <Link className="text-button" href="/app/lessons">
            <LocalizedText
              text={data.completed ? 'Challenge complete! Try another lesson' : 'Pick an adventure'}
            />
            <ArrowRight size={14} />
          </Link>
        </section>
        <section className="panel">
          <span className="panel-kicker">
            <Flame size={18} />
            <LocalizedText text="Keep the spark alive" />
          </span>
          <h2>
            <LocalizedText text="Three days of little discoveries." />
          </h2>
          <p>
            <LocalizedText text="Complete an activity on three consecutive days to unlock your On a roll badge." />
          </p>
          <ProgressBar
            value={Math.min(100, (data.streak / 3) * 100)}
            className="challenge-progress"
          />
          <div className="level-caption">
            <span>
              <LocalizedText text={`${Math.min(3, data.streak)} of 3 days`} />
            </span>
            <Link href="/app/lessons">
              <LocalizedText text="Explore today" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
