'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session';
import { CreateLesson } from '@/components/create-lesson';
import { Loading } from '@/components/ui';
export default function CreatePage() {
  const { user } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (user?.accountType === 'CHILD') router.replace('/app/lessons');
    else if (user?.accountType === 'PARENT') router.replace('/parent/create');
  }, [user, router]);
  if (!user || user.accountType === 'CHILD' || user.accountType === 'PARENT') return <Loading />;
  return <CreateLesson />;
}
