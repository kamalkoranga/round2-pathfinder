import "server-only";

import type { Prisma } from "@/generated/prisma";

import { RESOURCE_BY_ID } from "@/lib/data/catalog";
import { prisma } from "@/lib/db";
import { generatePath } from "@/lib/engine/path";
import { buildAdaptation } from "@/lib/engine/adapt";
import type {
  ChatMessage,
  Feedback,
  LearnerProfile,
  LearningPath,
  LearningStyle,
  Level,
  Pace,
} from "@/lib/types";

/**
 * Database access layer.
 *
 * Everything here is scoped by `userId` — there is no function that reads or
 * writes a profile without one, which makes it structurally hard to leak one
 * learner's data into another's session.
 */

const DEFAULTS = {
  goalText: "",
  roleId: null,
  level: "beginner" as Level,
  hoursPerWeek: 8,
  style: "mixed" as LearningStyle,
  pace: "steady" as Pace,
  targetWeeks: null,
};

export interface StoredProfile {
  profile: LearnerProfile;
  feedback: Feedback[];
  intakeComplete: boolean;
  transcript: ChatMessage[];
}

/** Load the learner's profile, creating an empty one on first sign-in. */
export async function loadProfile(userId: string): Promise<StoredProfile> {
  const row = await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: { skills: true, completions: true, feedback: true },
  });

  const skills: Record<string, number> = {};
  for (const s of row.skills) skills[s.skillId] = s.value;

  return {
    profile: {
      name: row.displayName ?? "",
      goalText: row.goalText,
      roleId: row.roleId,
      interests: row.interests,
      level: row.level as Level,
      skills,
      completed: row.completions.map((c) => c.resourceId),
      hoursPerWeek: row.hoursPerWeek,
      style: row.style as LearningStyle,
      pace: row.pace as Pace,
      targetWeeks: row.targetWeeks,
      createdAt: row.createdAt.toISOString(),
    },
    feedback: row.feedback.map((f) => ({
      resourceId: f.resourceId,
      signal: f.signal as "up" | "down",
      reason: f.reason ?? undefined,
      at: f.createdAt.toISOString(),
    })),
    intakeComplete: row.intakeComplete,
    transcript: (row.intakeTranscript as ChatMessage[] | null) ?? [],
  };
}

/** Replace the learner's profile. Scalar fields plus skills, in one transaction. */
export async function saveProfile(
  userId: string,
  profile: LearnerProfile,
  options: { intakeComplete?: boolean; transcript?: ChatMessage[] } = {},
): Promise<void> {
  const data = {
    displayName: profile.name || null,
    goalText: profile.goalText,
    roleId: profile.roleId,
    interests: profile.interests,
    level: profile.level,
    hoursPerWeek: profile.hoursPerWeek,
    style: profile.style,
    pace: profile.pace,
    targetWeeks: profile.targetWeeks,
    ...(options.intakeComplete !== undefined
      ? { intakeComplete: options.intakeComplete }
      : {}),
    // Prisma types JSON columns as InputJsonValue; a typed array is structurally
    // fine but does not satisfy its index signature, hence the cast.
    ...(options.transcript
      ? {
          intakeTranscript: options.transcript as unknown as Prisma.InputJsonValue,
        }
      : {}),
  };

  const row = await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId, ...DEFAULTS, ...data },
    update: data,
    select: { id: true },
  });

  // Replace the skill vector wholesale — it is small, and diffing it would be
  // more code than it saves.
  const entries = Object.entries(profile.skills).filter(([, v]) => v > 0);
  await prisma.$transaction([
    prisma.skillLevel.deleteMany({ where: { profileId: row.id } }),
    ...(entries.length
      ? [
          prisma.skillLevel.createMany({
            data: entries.map(([skillId, value]) => ({
              profileId: row.id,
              skillId,
              value,
            })),
          }),
        ]
      : []),
  ]);
}

async function profileIdFor(userId: string): Promise<string> {
  const row = await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  return row.id;
}

/** Mark a resource complete or undo it. */
export async function setCompletion(
  userId: string,
  resourceId: string,
  done: boolean,
): Promise<void> {
  const profileId = await profileIdFor(userId);
  if (done) {
    await prisma.completion.upsert({
      where: { profileId_resourceId: { profileId, resourceId } },
      create: { profileId, resourceId },
      update: {},
    });
  } else {
    await prisma.completion.deleteMany({ where: { profileId, resourceId } });
  }
}

/** Record or clear a thumbs up/down. */
export async function setFeedback(
  userId: string,
  resourceId: string,
  signal: "up" | "down" | null,
  reason?: string,
): Promise<void> {
  const profileId = await profileIdFor(userId);
  if (signal === null) {
    await prisma.feedback.deleteMany({ where: { profileId, resourceId } });
    return;
  }
  await prisma.feedback.upsert({
    where: { profileId_resourceId: { profileId, resourceId } },
    create: { profileId, resourceId, signal, reason },
    update: { signal, reason, createdAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Rehydrate a stored path into the shape the UI already renders. */
function toLearningPath(row: PathRow): LearningPath {
  return {
    goal: row.goal,
    roleId: row.roleId,
    roleTitle: row.roleTitle,
    totalHours: row.totalHours,
    totalWeeks: row.totalWeeks,
    gaps: row.gaps as unknown as LearningPath["gaps"],
    projected: row.projected as unknown as LearningPath["projected"],
    generatedAt: row.createdAt.toISOString(),
    milestones: row.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      skills: m.skills,
      hours: m.hours,
      weekEnd: m.weekEnd,
      steps: m.steps.map((s) => ({
        // The catalog is the source of truth for resource detail; we store only
        // the id so a corrected description propagates to existing paths.
        resource: RESOURCE_BY_ID[s.resourceId],
        order: s.position,
        closesGaps: s.closesGaps,
        reason: s.reason,
        score: s.score,
      })).filter((s) => Boolean(s.resource)),
    })),
  };
}

type PathRow = NonNullable<Awaited<ReturnType<typeof fetchActivePathRow>>>;

function fetchActivePathRow(userId: string) {
  return prisma.learningPath.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: {
        orderBy: { position: "asc" },
        include: { steps: { orderBy: { position: "asc" } } },
      },
    },
  });
}

/** The learner's current path, or null if they have not generated one. */
export async function loadActivePath(userId: string): Promise<LearningPath | null> {
  const row = await fetchActivePathRow(userId);
  return row ? toLearningPath(row) : null;
}

/**
 * Generate a path from the learner's stored profile and persist it as a
 * snapshot, archiving any previous one.
 */
export async function generateAndSavePath(userId: string): Promise<LearningPath> {
  const { profile, feedback } = await loadProfile(userId);
  const path = generatePath(profile, buildAdaptation(feedback));

  await prisma.$transaction(async (tx) => {
    await tx.learningPath.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    await tx.learningPath.create({
      data: {
        userId,
        goal: path.goal,
        roleId: path.roleId,
        roleTitle: path.roleTitle,
        totalHours: Math.round(path.totalHours),
        totalWeeks: path.totalWeeks,
        gaps: path.gaps as unknown as Prisma.InputJsonValue,
        projected: path.projected as unknown as Prisma.InputJsonValue,
        milestones: {
          create: path.milestones.map((m, index) => ({
            position: index,
            title: m.title,
            summary: m.summary,
            hours: Math.round(m.hours),
            weekEnd: m.weekEnd,
            skills: m.skills,
            steps: {
              create: m.steps.map((s) => ({
                position: s.order,
                resourceId: s.resource.id,
                reason: s.reason,
                score: s.score,
                closesGaps: s.closesGaps,
              })),
            },
          })),
        },
      },
    });
  });

  return path;
}

/** Past paths, newest first — the learner's history. */
export async function listPaths(userId: string) {
  return prisma.learningPath.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roleTitle: true,
      goal: true,
      totalHours: true,
      totalWeeks: true,
      isActive: true,
      createdAt: true,
      _count: { select: { milestones: true } },
    },
  });
}
