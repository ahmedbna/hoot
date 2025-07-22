'use client';

import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';

export const SignOutButton = () => {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  return (
    <>
      {isAuthenticated && (
        <button
          className='text-foreground rounded-md bg-slate-200 px-2 py-1 dark:bg-slate-800'
          onClick={() =>
            void signOut().then(() => {
              router.push('/signin');
            })
          }
        >
          Sign out
        </button>
      )}
    </>
  );
};
