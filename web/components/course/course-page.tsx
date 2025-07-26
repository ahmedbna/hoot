'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { Card, CardHeader } from '../ui/card';

type Props = {
  courseId: Id<'courses'>;
};

export const CoursePage = ({ courseId }: Props) => {
  const lessons = useQuery(api.lessons.getByCourse, { courseId });

  if (lessons === undefined) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <h1 className='text-4xl font-bold'>Loading...</h1>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <h1 className='text-2xl font-bold'>
          No lessons available for this course.
        </h1>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4'>
      {lessons.map((lesson) => (
        <Link href={`/lesson/${lesson._id}`} key={lesson._id}>
          <Card>
            <CardHeader className='pb-3'>
              <h2 className='text-xl font-semibold'>{lesson.title}</h2>
              <p className='text-sm text-gray-500'>
                {lesson.objectives.join(', ')}
              </p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
};
