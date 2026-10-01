-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `lecturaReleased` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ClassGroup` ADD COLUMN `lecturaReleasedAt` DATETIME(3) NULL;
