import { CoursePage } from '@/components/course/course-page';
import { Id } from '@/convex/_generated/dataModel';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = id as Id<'courses'>;

  return <CoursePage courseId={courseId} />;
}
