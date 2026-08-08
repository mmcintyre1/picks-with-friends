-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "league" TEXT;

-- AlterTable
ALTER TABLE "Window" ADD COLUMN     "isFreeForAll" BOOLEAN NOT NULL DEFAULT false;
