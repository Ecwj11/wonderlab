'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Languages, LoaderCircle } from 'lucide-react';
import { userPreferencesSchema, type UiLanguage } from '@wonderlab/shared';
import { api } from '@/lib/api';
import { translations } from '@/lib/translations';
import { useSession } from './session';

const patterns = Object.entries(translations)
  .filter(([key]) => key.includes('{'))
  .map(([key, translation]) => {
    const names: string[] = [];
    const escaped = key
      .split(/(\{\w+\})/)
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          names.push(part.slice(1, -1));
          return '(.+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { matcher: new RegExp('^' + escaped + '$'), names, translation };
  });
export function chineseText(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (translations[trimmed]) return translations[trimmed];
  for (const { matcher, names, translation } of patterns) {
    const match = trimmed.match(matcher);
    if (match)
      return translation.replace(
        /\{(\w+)\}/g,
        (_, key: string) => match[names.indexOf(key) + 1] ?? '',
      );
  }
  return text;
}
const Context = createContext<{
  language: UiLanguage;
  loading: boolean;
  saving: boolean;
  error: string;
  setLanguage: (language: UiLanguage) => Promise<void>;
  reload: () => Promise<void>;
}>({
  language: 'en',
  loading: false,
  saving: false,
  error: '',
  setLanguage: async () => {},
  reload: async () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const userId = user?.id;
  const [language, setCurrent] = useState<UiLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const preference = userPreferencesSchema.parse(await api('/preferences'));
      setCurrent(preference.uiLanguage);
      setError('');
    } catch {
      setError('Unable to load your language preference.');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (userId) void reload();
  }, [userId, reload]);
  const setLanguage = async (next: UiLanguage) => {
    if (saving || !userId) return;
    const previous = language;
    setCurrent(next);
    setSaving(true);
    setError('');
    try {
      const preference = userPreferencesSchema.parse(
        await api('/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ uiLanguage: next }),
        }),
      );
      setCurrent(preference.uiLanguage);
    } catch {
      setCurrent(previous);
      setError('Unable to save your language. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Context.Provider value={{ language, loading, saving, error, setLanguage, reload }}>
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  const context = useContext(Context);
  return {
    ...context,
    t: (text: string) => {
      const zh = chineseText(text);
      return context.language === 'zh'
        ? zh
        : context.language === 'en-zh' && zh !== text
          ? `${text} · ${zh}`
          : text;
    },
  };
}
export function LocalizedText({ text, className = '' }: { text: string; className?: string }) {
  const { language } = useI18n();
  const zh = chineseText(text);
  if (language === 'en' || zh === text) return <>{text}</>;
  if (language === 'zh')
    return (
      <span lang="zh-Hans" className={className}>
        {zh}
      </span>
    );
  return (
    <span className={'localized-pair ' + className}>
      <span lang="en">{text}</span>
      <span lang="zh-Hans" className="localized-zh">
        {zh}
      </span>
    </span>
  );
}
export function LanguageSelector() {
  const { language, setLanguage, saving, loading, error, reload, t } = useI18n();
  return (
    <div className="language-control">
      <label className="language-select">
        {saving ? <LoaderCircle size={16} className="spin" /> : <Languages size={17} />}
        <span className="sr-only">{t('Choose your interface language')}</span>
        <select
          aria-label="Interface language"
          value={language}
          disabled={saving || loading}
          onChange={(event) => void setLanguage(event.target.value as UiLanguage)}
        >
          <option value="en">EN</option>
          <option value="zh">中文</option>
          <option value="en-zh">EN + 中文</option>
        </select>
      </label>
      {saving && (
        <span className="sr-only" role="status">
          {t('Saving language…')}
        </span>
      )}
      {error && (
        <div className="language-error" role="alert">
          <LocalizedText text={error} />
          <button type="button" onClick={() => void reload()}>
            {t('Try again')}
          </button>
        </div>
      )}
    </div>
  );
}
