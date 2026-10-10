'use client';
import { useParams } from 'next/navigation';
import { AdminFamilies, AdminPlans, AdminSubscriptions } from '@/components/admin-family';
import { AdminDashboard } from '@/components/admin-dashboard';
import {
  AdminTable,
  AdminConfiguration,
  AdminSettings,
  AdminSubjects,
} from '@/components/admin-sections';
export default function Section() {
  const { section } = useParams<{ section: string }>();
  if (section === 'families') return <AdminFamilies />;
  if (section === 'plans') return <AdminPlans />;
  if (section === 'subscriptions') return <AdminSubscriptions />;
  if (section === 'reports') return <AdminDashboard reports />;
  if (section === 'ai-configuration') return <AdminConfiguration />;
  if (section === 'settings') return <AdminSettings />;
  if (section === 'subjects') return <AdminSubjects />;
  if (['users', 'lessons', 'generation-jobs', 'content-library', 'usage'].includes(section))
    return <AdminTable section={section} />;
  return (
    <div className="admin-page-heading">
      <h1>Page not found.</h1>
    </div>
  );
}
