-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `partialClosed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `partialClosedAt` DATETIME(3) NULL;
