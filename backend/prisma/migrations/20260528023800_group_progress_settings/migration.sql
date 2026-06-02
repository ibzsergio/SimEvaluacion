-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `plannedActivities` INTEGER NULL,
    ADD COLUMN `progressClosed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `progressClosedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);
