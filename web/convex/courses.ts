import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

export const get = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const enrolls = await ctx.db
      .query('enrolls')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (!enrolls) {
      throw new Error('No enrollments found');
    }

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_language', (q) =>
        q.eq('languageId', enrolls.learningLanguage)
      )
      .collect();

    if (!courses) {
      throw new Error('No courses found for the selected language');
    }

    return courses;
  },
});
