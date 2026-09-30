-- AlterTable
ALTER TABLE `ClassGroup` ADD COLUMN `diplomaEnabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ClassGroup` ADD COLUMN `diplomaEnabledAt` DATETIME(3) NULL;
