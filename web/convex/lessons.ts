import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { api } from './_generated/api';
import { action, mutation, query } from './_generated/server';

export const getAll = query({
  handler: async (ctx, args) => {
    const languages = await ctx.db.query('languages').collect();

    if (!languages) {
      throw new Error('No languages found');
    }

    return languages;
  },
});
