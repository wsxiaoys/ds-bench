-- AddBioDriftFix
-- This migration acknowledges the bio column that was added via SQL
-- The column already exists in the database, so this is a no-op migration

ALTER TABLE "User" ADD COLUMN "bio" TEXT;