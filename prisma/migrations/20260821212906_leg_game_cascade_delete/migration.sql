-- DropForeignKey
ALTER TABLE "Leg" DROP CONSTRAINT "Leg_gameId_fkey";

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
