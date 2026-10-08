ALTER TABLE `ClassGroup` ADD COLUMN `compilerReleased` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ClassGroup` ADD COLUMN `compilerReleasedAt` DATETIME(3) NULL;
