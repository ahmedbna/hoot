import { v } from 'convex/values';
import { query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

export const get = query({
  args: {
    lessonId: v.id('lessons'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const lesson = await ctx.db.get(args.lessonId);

    if (!lesson) {
      throw new Error('No lesson found');
    }

    return lesson;
  },
});

export const getByCourse = query({
  args: {
    courseId: v.id('courses'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const lessons = await ctx.db
      .query('lessons')
      .withIndex('by_course', (q) => q.eq('courseId', args.courseId))
      .collect();

    if (!lessons) {
      throw new Error('No lessons found');
    }

    return lessons;
  },
});
