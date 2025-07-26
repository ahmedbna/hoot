import { headers } from 'next/headers';
import { App } from '@/components/app';
import { getAppConfig } from '@/lib/utils';
import { Id } from '@/convex/_generated/dataModel';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lessonId = id as Id<'lessons'>;

  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <App appConfig={appConfig} lessonId={lessonId} />;
}
