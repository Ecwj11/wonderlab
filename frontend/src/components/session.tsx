'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@wonderlab/shared';
import { api, RequestError } from '@/lib/api';
const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}>({ user: null, loading: true, error: '', refresh: async () => {} });
export function SessionProvider({
  children,
  loginPath = '/login',
}: {
  children: React.ReactNode;
  loginPath?: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const refresh = useCallback(async () => {
    try {
      const u = await api<User>('/auth/me');
      setUser(u);
      setError('');
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) router.replace(loginPath);
      else setError(e instanceof Error ? e.message : 'Unable to connect.');
    } finally {
      setLoading(false);
    }
  }, [router, loginPath]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <Context.Provider value={{ user, loading, error, refresh }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
