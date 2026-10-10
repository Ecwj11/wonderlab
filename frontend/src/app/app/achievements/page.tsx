'use client';
import { LocalizedText } from '@/components/i18n';
import { Trophy, Compass, Rocket, Star, Flame, Zap, Lock, Check, Sparkles } from 'lucide-react';
import { useApi, Loading, ErrorState } from '@/components/ui';
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
}
const icons: Record<string, typeof Trophy> = {
  compass: Compass,
  rocket: Rocket,
  star: Star,
  flame: Flame,
  zap: Zap,
};
export default function Achievements() {
  const { data, error, loading, reload } = useApi<Achievement[]>('/achievements');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Sparkles size={14} />
            <LocalizedText text="Little badges. Big moments." />
          </div>
          <h1>
            <LocalizedText text="Your curiosity deserves a little celebration." />
          </h1>
          <p>
            <LocalizedText
              text={`${data.filter((a) => a.earnedAt).length} of ${data.length} discoveries unlocked. Keep exploring.`}
            />
          </p>
        </div>
      </div>
      <div className="badge-grid">
        {data.map((a) => {
          const Icon = icons[a.icon] || Trophy;
          return (
            <article className={'badge-card ' + (a.earnedAt ? 'earned' : '')} key={a.id}>
              <span className="badge-icon">
                <Icon size={35} />
              </span>
              <h3>
                <LocalizedText text={a.name} />
              </h3>
              <p>
                <LocalizedText text={a.description} />
              </p>
              <span className="badge-status">
                {a.earnedAt ? (
                  <>
                    <Check size={12} />
                    <LocalizedText text="Earned" />{' '}
                    {new Date(a.earnedAt).toLocaleDateString('en', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </>
                ) : (
                  <>
                    <Lock size={12} />
                    <LocalizedText text="A little more discovery awaits" />
                  </>
                )}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
