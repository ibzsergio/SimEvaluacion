-- CreateTable
CREATE TABLE `GroupWeek` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `weekStart` DATE NOT NULL,
    `weekEnd` DATE NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GroupWeek_groupId_idx`(`groupId`),
    UNIQUE INDEX `GroupWeek_groupId_weekStart_key`(`groupId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyWinner` (
    `id` VARCHAR(191) NOT NULL,
    `weekId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WeeklyWinner_weekId_key`(`weekId`),
    INDEX `WeeklyWinner_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GroupWeek` ADD CONSTRAINT `GroupWeek_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyWinner` ADD CONSTRAINT `WeeklyWinner_weekId_fkey` FOREIGN KEY (`weekId`) REFERENCES `GroupWeek`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyWinner` ADD CONSTRAINT `WeeklyWinner_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
