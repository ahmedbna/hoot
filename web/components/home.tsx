'use client';

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';

export const Home = () => {
  const user = useQuery(api.users.get);
  const enrolls = useQuery(api.enrolls.getAll);

  if (user === undefined || enrolls === undefined) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <h1 className='text-4xl font-bold'>Loading...</h1>
      </div>
    );
  }

  return (
    <div className='flex items-center justify-center h-screen'>
      {!user?.gender || !user?.birthday || !enrolls?.length ? (
        <OnboardingFlow onComplete={(data) => console.log(data)} />
      ) : (
        <div>
          {enrolls.map((enroll) => (
            <p>{enroll._id}</p>
          ))}
        </div>
      )}
    </div>
  );
};
