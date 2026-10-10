'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { appearanceSchema, portalTemplateSchema, type PortalTemplate } from '@wonderlab/shared';
import { api } from '@/lib/api';
import { useSession } from './session';

const Context = createContext<{
  template: PortalTemplate;
  preview: boolean;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}>({ template: 'playground', preview: false, loading: true, error: '', reload: async () => {} });

export function PortalAppearanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const [saved, setSaved] = useState<PortalTemplate | null>(null);
  const [preview, setPreview] = useState<PortalTemplate | null>(null);
  const [error, setError] = useState('');
  const userId = user?.id;
  const isAdmin = !!user?.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN');
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const response = appearanceSchema.parse(await api('/appearance'));
      setSaved(response.template);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the learning template.');
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const candidate = portalTemplateSchema.safeParse(
      new URLSearchParams(window.location.search).get('previewTemplate'),
    );
    setPreview(isAdmin && candidate.success ? candidate.data : null);
    void reload();
    const refreshVisible = () => {
      if (!document.hidden) void reload();
    };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, 60000);
    return () => {
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.clearInterval(timer);
    };
  }, [userId, isAdmin, pathname, reload]);
  return (
    <Context.Provider
      value={{
        template: preview ?? saved ?? 'playground',
        preview: preview !== null,
        loading: saved === null && !error,
        error: saved === null ? error : '',
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const usePortalAppearance = () => useContext(Context);
