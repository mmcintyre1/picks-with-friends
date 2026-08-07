-- AlterTable
ALTER TABLE "Parlay" ADD COLUMN     "oddsOverride" INTEGER;

-- AlterTable
ALTER TABLE "Window" DROP COLUMN "singleGame";
