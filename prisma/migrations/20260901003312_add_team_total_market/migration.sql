-- CreateEnum
CREATE TYPE "TeamSide" AS ENUM ('HOME', 'AWAY');

-- AlterEnum
ALTER TYPE "Market" ADD VALUE 'TEAM_TOTAL';

-- AlterTable
ALTER TABLE "Leg" ADD COLUMN     "teamSide" "TeamSide";
