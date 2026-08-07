-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINAL');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('SPREAD', 'TOTAL', 'MONEYLINE');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('HOME', 'AWAY', 'OVER', 'UNDER');

-- CreateEnum
CREATE TYPE "ParlayStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED', 'VOID');

-- CreateEnum
CREATE TYPE "LegResult" AS ENUM ('PENDING', 'WIN', 'LOSS', 'PUSH');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('CONFIRMED', 'STALE');

-- CreateEnum
CREATE TYPE "Badge" AS ENUM ('NONE', 'MONEYBAG', 'POO', 'TOILET', 'CROSS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "pinHash" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Window" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "label" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Window_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "externalId" TEXT,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "homeLine" DOUBLE PRECISION,
    "awayLine" DOUBLE PRECISION,
    "homePrice" INTEGER,
    "awayPrice" INTEGER,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parlay" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT,
    "status" "ParlayStatus" NOT NULL DEFAULT 'OPEN',
    "countsForRecord" BOOLEAN NOT NULL DEFAULT true,
    "result" "LegResult" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Parlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leg" (
    "id" TEXT NOT NULL,
    "parlayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "side" "Side" NOT NULL,
    "lineAtPick" DOUBLE PRECISION,
    "priceAtPick" INTEGER,
    "status" "LegStatus" NOT NULL DEFAULT 'CONFIRMED',
    "result" "LegResult" NOT NULL DEFAULT 'PENDING',
    "badge" "Badge" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_windowId_externalId_key" ON "Game"("windowId", "externalId");

-- CreateIndex
CREATE INDEX "OddsSnapshot_gameId_market_fetchedAt_idx" ON "OddsSnapshot"("gameId", "market", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Leg_parlayId_userId_key" ON "Leg"("parlayId", "userId");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Window"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

