import { CreateLesson } from '@/components/create-lesson';
import { LessonCollection } from '@/components/lesson-collection';
import { FamilyLearningGuard } from '@/components/family-learning-guard';
import { notFound } from 'next/navigation';
import { ParentChildren } from '@/components/parent-children';
import { ParentRewards } from '@/components/parent-rewards';
import { ParentBilling } from '@/components/parent-billing';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'create')
    return (
      <FamilyLearningGuard>
        <CreateLesson />
      </FamilyLearningGuard>
    );
  if (section === 'lessons')
    return (
      <FamilyLearningGuard>
        <LessonCollection />
      </FamilyLearningGuard>
    );
  if (section === 'rewards') return <ParentRewards />;
  if (section === 'children') return <ParentChildren />;
  if (section === 'billing' || section === 'subscription') return <ParentBilling />;
  notFound();
}
