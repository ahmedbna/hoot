import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';

export const get = query({
  args: {
    languageId: v.id('languages'), // Learning language ID
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);

    if (!authId) {
      throw new Error('Not authenticated');
    }

    const student = await ctx.db
      .query('enrolls')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', authId).eq('learningLanguage', args.languageId)
      );

    return student;
  },
});

export const getAll = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const languages = await ctx.db
      .query('enrolls')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    if (!languages) {
      throw new Error('No languages found');
    }

    return languages;
  },
});

export const create = mutation({
  args: {
    nativeLanguage: v.id('languages'),
    learningLanguage: v.id('languages'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const studentId = await ctx.db.insert('enrolls', {
      userId,
      nativeLanguage: args.nativeLanguage,
      learningLanguage: args.learningLanguage,
    });

    return studentId;
  },
});
