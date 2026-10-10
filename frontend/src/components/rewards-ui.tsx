'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rewardImages,
  type FamilyReward,
  type Paginated,
  type RewardRedemption,
} from '@wonderlab/shared';
import { api } from '@/lib/api';
import { LocalizedText, useI18n } from './i18n';

export function RewardPicture({ prize }: { prize: Pick<FamilyReward, 'imageKey' | 'emoji'> }) {
  const illustration = prize.imageKey ? rewardImages[prize.imageKey] : null;
  return illustration ? (
    // Local, curated illustrations; no external image URLs are accepted from prize input.
    <img
      className="reward-picture"
      src={illustration.src}
      alt=""
      loading="lazy"
      width={320}
      height={240}
    />
  ) : (
    <span className="reward-emoji" aria-hidden="true">
      {prize.emoji}
    </span>
  );
}

export const starsChanged = () => window.dispatchEvent(new Event('wonderlab:stars-changed'));
export const rewardStatus: Record<RewardRedemption['status'], string> = {
  PENDING: 'Waiting for your parent',
  FULFILLED: 'Given',
  DECLINED: 'Declined · Stars returned',
  CANCELLED: 'Cancelled · Stars returned',
};
export function useRewardsApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    try {
      const next = await api<T>(path);
      if (request === version.current) {
        setData(next);
        setError('');
      }
    } catch (e) {
      if (request === version.current)
        setError(e instanceof Error ? e.message : 'Unable to load prizes.');
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      version.current++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
export function RewardsPagination({
  data,
  page,
  onPage,
  busy = false,
}: {
  data: Pick<Paginated<unknown>, 'totalPages'> | null;
  page: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  if (!data || (data.totalPages <= 1 && page <= 1)) return null;
  return (
    <nav className="rewards-pagination" aria-label={t('Prize history pagination')}>
      <button
        className="button secondary"
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <LocalizedText text="Previous" />
      </button>
      <span>
        <LocalizedText
          text={
            page > data.totalPages
              ? 'This page is empty. Go back to an earlier page.'
              : `Page ${page} of ${data.totalPages}`
          }
        />
      </span>
      <button
        className="button secondary"
        disabled={busy || page >= data.totalPages}
        onClick={() => onPage(page + 1)}
      >
        <LocalizedText text="Next" />
      </button>
    </nav>
  );
}
export function RewardDate({ date }: { date: string }) {
  const { language } = useI18n();
  return (
    <time dateTime={date}>
      {new Date(date).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </time>
  );
}
