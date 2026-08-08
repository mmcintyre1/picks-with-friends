-- AlterTable
ALTER TABLE "Parlay" ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "lockedById" TEXT;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
