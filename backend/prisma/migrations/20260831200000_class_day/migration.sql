-- CreateTable
CREATE TABLE `ClassDayRecord` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `attendance` ENUM('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED') NOT NULL DEFAULT 'PRESENT',
    `stars` INTEGER NOT NULL DEFAULT 0,
    `markedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClassDayRecord_groupId_studentId_date_key`(`groupId`, `studentId`, `date`),
    INDEX `ClassDayRecord_groupId_date_idx`(`groupId`, `date`),
    INDEX `ClassDayRecord_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClassDayRecord` ADD CONSTRAINT `ClassDayRecord_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassDayRecord` ADD CONSTRAINT `ClassDayRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassDayRecord` ADD CONSTRAINT `ClassDayRecord_markedById_fkey` FOREIGN KEY (`markedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
