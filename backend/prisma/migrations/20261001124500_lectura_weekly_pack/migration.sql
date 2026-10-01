-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `lecturaTopic` VARCHAR(240) NULL;
ALTER TABLE `ClassGroup` ADD COLUMN `lecturaSessionNumber` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `ClassGroup` ADD COLUMN `lecturaPayload` JSON NULL;
