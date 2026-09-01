-- CreateTable
CREATE TABLE `SeatingSession` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'column_colors',
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SeatingSession_groupId_date_key`(`groupId`, `date`),
    INDEX `SeatingSession_groupId_date_idx`(`groupId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatingAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `row` INTEGER NOT NULL,
    `col` INTEGER NOT NULL,
    `color` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SeatingAssignment_sessionId_studentId_key`(`sessionId`, `studentId`),
    UNIQUE INDEX `SeatingAssignment_sessionId_row_col_key`(`sessionId`, `row`, `col`),
    INDEX `SeatingAssignment_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SeatingSession` ADD CONSTRAINT `SeatingSession_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatingSession` ADD CONSTRAINT `SeatingSession_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatingAssignment` ADD CONSTRAINT `SeatingAssignment_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `SeatingSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatingAssignment` ADD CONSTRAINT `SeatingAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
