-- Preserve Excel column order (CARATULA → CODIGOS CLIENTE, etc.)
ALTER TABLE `Activity` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `Activity_groupId_sortOrder_idx` ON `Activity`(`groupId`, `sortOrder`);
