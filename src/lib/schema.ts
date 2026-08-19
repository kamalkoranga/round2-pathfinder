import { z } from "zod";

/** Wire-format validation for anything the client posts to an API route. */

export const ProfileSchema = z.object({
  name: z.string().max(80).default(""),
  goalText: z.string().max(2000).default(""),
  roleId: z.string().max(60).nullable().default(null),
  interests: z.array(z.string().max(60)).max(20).default([]),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  skills: z.record(z.string().max(60), z.number().min(0).max(1)).default({}),
  completed: z.array(z.string().max(60)).max(300).default([]),
  hoursPerWeek: z.number().min(1).max(60).default(8),
  style: z
    .enum(["video", "hands-on", "reading", "interactive", "mixed"])
    .default("mixed"),
  pace: z.enum(["relaxed", "steady", "intensive"]).default("steady"),
  targetWeeks: z.number().min(1).max(104).nullable().default(null),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const FeedbackSchema = z.object({
  resourceId: z.string().max(60),
  signal: z.enum(["up", "down"]),
  reason: z.string().max(40).optional(),
  at: z.string(),
});

export const FeedbackListSchema = z.array(FeedbackSchema).max(500).default([]);

/** Alias used by the persistence routes, which store the same shape. */
export const LearnerProfileSchema = ProfileSchema;

export const ChatMessagesSchema = z
  .array(
    z.object({
      id: z.string().max(60),
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
      at: z.string(),
    }),
  )
  .max(60);

/** Body of POST /api/progress. */
export const ProgressSchema = z.object({
  resourceId: z.string().max(60),
  done: z.boolean(),
});

/** Body of POST /api/feedback. `signal: null` clears an existing rating. */
export const RatingSchema = z.object({
  resourceId: z.string().max(60),
  signal: z.enum(["up", "down"]).nullable(),
  reason: z.string().max(40).optional(),
});
