CREATE TABLE `SqlScrumDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `activityKey` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `teamKey` VARCHAR(191) NOT NULL,
    `teamName` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileData` LONGBLOB NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SqlScrumDelivery_activityKey_groupId_teamKey_key`(`activityKey`, `groupId`, `teamKey`),
    INDEX `SqlScrumDelivery_groupId_activityKey_idx`(`groupId`, `activityKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
