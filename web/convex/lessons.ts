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

    const course = await ctx.db.get(lesson.courseId);

    if (!course) {
      throw new Error('No course found for the lesson');
    }

    const enroll = await ctx.db
      .query('enrolls')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('learningLanguage', course.languageId)
      )
      .first();

    if (!enroll) {
      throw new Error('User is not enrolled in the course language');
    }

    const learn = await ctx.db.get(enroll.learningLanguage);

    if (!learn) {
      throw new Error('Learning language not found');
    }

    const native = await ctx.db.get(enroll.nativeLanguage);

    if (!native) {
      throw new Error('Native language not found');
    }

    return {
      ...lesson,
      course,
      enroll: {
        ...enroll,
        learningLanguage: learn.name,
        nativeLanguage: native.name,
      },
    };
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
