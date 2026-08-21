-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "espnEventId" TEXT;

-- AlterTable
ALTER TABLE "Parlay" ADD COLUMN     "lastEvaluatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Game_windowId_espnEventId_key" ON "Game"("windowId", "espnEventId");
