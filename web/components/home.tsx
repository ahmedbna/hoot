'use client';

import Link from 'next/link';
import {
  OnboardingData,
  OnboardingFlow,
} from '@/components/onboarding/onboarding-flow';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const Home = () => {
  const user = useQuery(api.users.get);
  const enrolls = useQuery(api.enrolls.getAll);
  const courses = useQuery(api.courses.get);

  const updateUser = useMutation(api.users.update);
  const createEnroll = useMutation(api.enrolls.create);

  if (user === undefined || enrolls === undefined || courses === undefined) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <h1 className='text-4xl font-bold'>Loading...</h1>
      </div>
    );
  }

  const onComplete = async (onboardingData: OnboardingData) => {
    await updateUser({
      gender: onboardingData.gender,
      birthday: onboardingData.birthday.getTime(),
    });

    await createEnroll({
      nativeLanguage: onboardingData.nativeLanguage._id,
      learningLanguage: onboardingData.targetLanguage._id,
    });
  };

  return (
    <div>
      {!user?.gender || !user?.birthday || !enrolls?.length ? (
        <div className='flex items-center justify-center h-screen'>
          <OnboardingFlow onComplete={onComplete} />
        </div>
      ) : (
        <div className='max-w-4xl mx-auto p-4'>
          <h1 className='text-3xl font-bold mb-4'>Welcome, {user.name}!</h1>
          <p className='mb-6'>
            You are enrolled in {enrolls.length} languages. Here are your
            courses:
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {courses.map((course) => (
              <Link href={`/course/${course._id}`} key={course._id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>{course.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
