-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Market" ADD VALUE 'PLAYER_PROP';
ALTER TYPE "Market" ADD VALUE 'PLAYER_PROP_YESNO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Side" ADD VALUE 'YES';
ALTER TYPE "Side" ADD VALUE 'NO';

-- AlterTable
ALTER TABLE "Leg" ADD COLUMN     "playerName" TEXT,
ADD COLUMN     "propType" TEXT;
