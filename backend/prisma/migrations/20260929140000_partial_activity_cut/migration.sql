-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `currentPartial` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `partialNumber` INTEGER NOT NULL DEFAULT 1;

-- Groups already closed start the next partial for new activities.
UPDATE `ClassGroup` SET `currentPartial` = 2 WHERE `partialClosed` = true AND `currentPartial` = 1;
