import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  students: defineTable({
    name: v.string(),
    email: v.string(),
    languageId: v.id('languages'),
  }).index('by_language', ['languageId']),

  languages: defineTable({
    name: v.string(),
    code: v.string(),
    native: v.optional(v.string()), // Optional native name
  }).index('by_name', ['name']),

  courses: defineTable({
    title: v.string(),
    description: v.string(),
    languageId: v.id('languages'),
  }).index('by_language', ['languageId']),

  lessons: defineTable({
    title: v.string(),
    content: v.string(),
    courseId: v.id('courses'),
  }).index('by_course', ['courseId']),
});
