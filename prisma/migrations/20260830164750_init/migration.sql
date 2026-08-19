-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT,
    "goalText" TEXT NOT NULL DEFAULT '',
    "roleId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 8,
    "style" TEXT NOT NULL DEFAULT 'mixed',
    "pace" TEXT NOT NULL DEFAULT 'steady',
    "targetWeeks" INTEGER,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intakeComplete" BOOLEAN NOT NULL DEFAULT false,
    "intakeTranscript" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillLevel" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SkillLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Completion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "goal" TEXT NOT NULL,
    "roleId" TEXT,
    "roleTitle" TEXT NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gaps" JSONB NOT NULL,
    "projected" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathStep" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "closesGaps" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PathStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");

-- CreateIndex
CREATE INDEX "SkillLevel_profileId_idx" ON "SkillLevel"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillLevel_profileId_skillId_key" ON "SkillLevel"("profileId", "skillId");

-- CreateIndex
CREATE INDEX "Completion_profileId_idx" ON "Completion"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Completion_profileId_resourceId_key" ON "Completion"("profileId", "resourceId");

-- CreateIndex
CREATE INDEX "Feedback_profileId_idx" ON "Feedback"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_profileId_resourceId_key" ON "Feedback"("profileId", "resourceId");

-- CreateIndex
CREATE INDEX "LearningPath_userId_isActive_idx" ON "LearningPath"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Milestone_pathId_idx" ON "Milestone"("pathId");

-- CreateIndex
CREATE INDEX "PathStep_milestoneId_idx" ON "PathStep"("milestoneId");

-- AddForeignKey
ALTER TABLE "SkillLevel" ADD CONSTRAINT "SkillLevel_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Completion" ADD CONSTRAINT "Completion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
