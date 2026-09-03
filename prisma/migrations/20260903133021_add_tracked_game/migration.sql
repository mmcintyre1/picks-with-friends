-- CreateTable
CREATE TABLE "TrackedGame" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "spreadHome" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "espnEventId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedGame_league_homeTeam_idx" ON "TrackedGame"("league", "homeTeam");

-- CreateIndex
CREATE INDEX "TrackedGame_league_awayTeam_idx" ON "TrackedGame"("league", "awayTeam");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedGame_league_homeTeam_awayTeam_commenceTime_key" ON "TrackedGame"("league", "homeTeam", "awayTeam", "commenceTime");
