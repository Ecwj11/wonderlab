'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { useEffect, useState, useCallback, useRef } from 'react';
import { LoaderCircle, ArrowRight, X, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load.');
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}
export function Loading({ label = 'Loading your learning space…' }: { label?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <p>
        <LocalizedText text={label} />
      </p>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <h3>
        <LocalizedText text="Let’s try that again." />
      </h3>
      <p>
        <LocalizedText text={message} />
      </p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={16} />
          <LocalizedText text="Try again" />
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-spark">✦</span>
      <h3>
        <LocalizedText text={title} />
      </h3>
      <p>
        <LocalizedText text={description} />
      </p>
      {children}
    </div>
  );
}
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      className={'progress-track ' + className}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const nodes = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ) || [],
      );
    nodes()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = nodes();
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(title)}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>
            <LocalizedText text={title} />
          </h2>
          <button className="icon-button" aria-label={t('Close dialog')} onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export const ButtonArrow = () => <ArrowRight size={17} />;
