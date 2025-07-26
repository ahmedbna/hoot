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
  }).index('email', ['email']),

  languages: defineTable({
    name: v.string(),
    code: v.string(), // ISO language code (e.g., 'en', 'fr', 'es')
    native: v.string(), // Native name of the language
    flag: v.optional(v.string()), // Flag emoji or image URL
  })
    .index('by_name', ['name'])
    .index('by_code', ['code']),

  enrolls: defineTable({
    userId: v.id('users'),
    nativeLanguage: v.id('languages'), // User's native language
    learningLanguage: v.id('languages'), // Language they are learning
    currentLessonId: v.optional(v.id('lessons')), // Current lesson progress
    completedLessons: v.optional(v.array(v.id('lessons'))), // Completed lessons
    totalTimeSpent: v.optional(v.number()), // Total time in minutes
  })
    .index('by_user', ['userId'])
    .index('by_user_language', ['userId', 'learningLanguage']),

  courses: defineTable({
    languageId: v.id('languages'),
    order: v.number(), // Order within the level
    title: v.string(),
    description: v.string(),
    estimatedDuration: v.optional(v.number()), // Duration in minutes
    prerequisites: v.optional(v.array(v.id('courses'))), // Required courses
  })
    .index('by_language', ['languageId'])
    .index('by_language_order', ['languageId', 'order']),

  lessons: defineTable({
    courseId: v.id('courses'),
    order: v.number(), // Order within the course
    title: v.string(), // Lesson title
    content: v.string(), // Detailed lesson content for the AI
    objectives: v.array(v.string()), // Learning objectives
    vocabulary: v.optional(v.string()), // Vocabulary words for the lesson
    grammar: v.optional(v.string()), // Grammar points covered
    estimatedDuration: v.optional(v.number()), // Duration in minutes
  })
    .index('by_course', ['courseId'])
    .index('by_course_order', ['courseId', 'order']),

  lessonSessions: defineTable({
    userId: v.id('users'),
    lessonId: v.id('lessons'),
    roomName: v.string(), // LiveKit room name
    sessionId: v.string(), // Unique session identifier
    startedAt: v.number(), // Timestamp
    endedAt: v.optional(v.number()), // Timestamp when session ended
    duration: v.optional(v.number()), // Session duration in minutes
    completed: v.boolean(), // Whether lesson was completed
    notes: v.optional(v.string()), // AI or user notes
    feedback: v.optional(
      v.object({
        pronunciation: v.optional(v.number()), // Score 1-10
        vocabulary: v.optional(v.number()), // Score 1-10
        grammar: v.optional(v.number()), // Score 1-10
        overall: v.optional(v.number()), // Score 1-10
        comments: v.optional(v.string()),
      })
    ),
    conversationLog: v.optional(
      v.array(
        v.object({
          timestamp: v.number(),
          speaker: v.union(v.literal('user'), v.literal('ai')),
          message: v.string(),
          translation: v.optional(v.string()),
        })
      )
    ),
  })
    .index('by_user', ['userId'])
    .index('by_lesson', ['lessonId'])
    .index('by_user_lesson', ['userId', 'lessonId'])
    .index('by_room', ['roomName'])
    .index('by_session', ['sessionId']),

  userProgress: defineTable({
    userId: v.id('users'),
    languageId: v.id('languages'),
    overallLevel: v.union(
      v.literal('beginner'),
      v.literal('intermediate'),
      v.literal('advanced')
    ),
    totalLessonsCompleted: v.number(),
    totalTimeSpent: v.number(), // Total time in minutes
    currentStreak: v.number(), // Days of consecutive practice
    longestStreak: v.number(),
    lastPracticeDate: v.optional(v.number()), // Timestamp
    skillScores: v.object({
      listening: v.number(), // Score 1-100
      speaking: v.number(), // Score 1-100
      reading: v.number(), // Score 1-100
      writing: v.number(), // Score 1-100
      pronunciation: v.number(), // Score 1-100
      vocabulary: v.number(), // Score 1-100
      grammar: v.number(), // Score 1-100
    }),
    achievements: v.optional(v.array(v.string())), // Achievement badges
  })
    .index('by_user', ['userId'])
    .index('by_language', ['languageId'])
    .index('by_user_language', ['userId', 'languageId']),

  // Store active AI sessions to manage concurrent sessions
  activeSessions: defineTable({
    userId: v.id('users'),
    roomName: v.string(),
    sessionId: v.string(),
    lessonId: v.id('lessons'),
    startedAt: v.number(),
    agentStatus: v.union(
      v.literal('active'),
      v.literal('connecting'),
      v.literal('disconnected')
    ),
  })
    .index('by_user', ['userId'])
    .index('by_room', ['roomName'])
    .index('by_session', ['sessionId']),
});
