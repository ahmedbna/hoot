import { query } from './_generated/server';

export const getAll = query({
  handler: async (ctx) => {
    const languages = await ctx.db.query('languages').collect();

    if (!languages) {
      throw new Error('No languages found');
    }

    return languages;
  },
});
