import { headers } from 'next/headers';
import { Home } from '@/components/home';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <Home appConfig={appConfig} />;
}
