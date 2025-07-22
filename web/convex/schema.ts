import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    gender: v.optional(v.string()),
    birthday: v.optional(v.number()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phoneVerificationTime: v.optional(v.float64()),
    heartbeat: v.optional(v.float64()),
  }).index('email', ['email']),

  students: defineTable({
    userId: v.id('users'),
    courseId: v.id('courses'),
  }).index('by_course', ['courseId']),

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
