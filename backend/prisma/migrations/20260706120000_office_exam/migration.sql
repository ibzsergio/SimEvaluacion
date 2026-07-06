-- CreateTable
CREATE TABLE `OfficeExam` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'Evaluación Office 2019',
    `enabledForStudents` BOOLEAN NOT NULL DEFAULT false,
    `enabledAt` DATETIME(3) NULL,
    `timeLimitMinutes` INTEGER NOT NULL DEFAULT 60,
    `questionCount` INTEGER NOT NULL DEFAULT 75,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OfficeExam_teacherId_key`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OfficeExamQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `program` ENUM('WORD', 'POWERPOINT', 'EXCEL') NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `questionText` TEXT NOT NULL,
    `optionA` TEXT NOT NULL,
    `optionB` TEXT NOT NULL,
    `optionC` TEXT NOT NULL,
    `optionD` TEXT NOT NULL,
    `correctOption` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `OfficeExamQuestion_examId_sortOrder_key`(`examId`, `sortOrder`),
    INDEX `OfficeExamQuestion_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OfficeExamAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    `answers` JSON NOT NULL,
    `correctCount` INTEGER NULL,
    `examScore4` DOUBLE NULL,
    `firmasScore6` DOUBLE NULL,
    `finalGrade` FLOAT NULL,
    `isExempt` BOOLEAN NOT NULL DEFAULT false,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `lastSavedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OfficeExamAttempt_examId_studentId_key`(`examId`, `studentId`),
    INDEX `OfficeExamAttempt_studentId_idx`(`studentId`),
    INDEX `OfficeExamAttempt_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OfficeExam` ADD CONSTRAINT `OfficeExam_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficeExamQuestion` ADD CONSTRAINT `OfficeExamQuestion_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `OfficeExam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficeExamAttempt` ADD CONSTRAINT `OfficeExamAttempt_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `OfficeExam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficeExamAttempt` ADD CONSTRAINT `OfficeExamAttempt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
