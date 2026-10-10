import { ParentShell } from '@/components/parent-shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ParentShell>{children}</ParentShell>;
}
