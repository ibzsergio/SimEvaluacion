-- Limpiar actividades de prueba sin grupo (opcional, solo desarrollo)
DELETE FROM `Grade`;
DELETE FROM `Activity`;

-- Tabla de grupos
CREATE TABLE `ClassGroup` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `shift` VARCHAR(191) NOT NULL DEFAULT 'matutino',
    `teacherId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClassGroup_teacherId_code_shift_key`(`teacherId`, `code`, `shift`),
    INDEX `ClassGroup_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grupos 201 y 202 para el docente Sergio (si existe)
INSERT INTO `ClassGroup` (`id`, `code`, `shift`, `teacherId`, `createdAt`, `updatedAt`)
SELECT CONCAT('grp201_', SUBSTRING(u.id, 1, 8)), '201', 'matutino', u.id, NOW(3), NOW(3)
FROM `User` u WHERE u.email = 'sergio@demo.local' AND u.role = 'TEACHER'
LIMIT 1;

INSERT INTO `ClassGroup` (`id`, `code`, `shift`, `teacherId`, `createdAt`, `updatedAt`)
SELECT CONCAT('grp202_', SUBSTRING(u.id, 1, 8)), '202', 'matutino', u.id, NOW(3), NOW(3)
FROM `User` u WHERE u.email = 'sergio@demo.local' AND u.role = 'TEACHER'
LIMIT 1;

-- Alumnos: número de lista y grupo
ALTER TABLE `User` ADD COLUMN `listNumber` INTEGER NULL,
    ADD COLUMN `groupId` VARCHAR(191) NULL;

CREATE INDEX `User_groupId_idx` ON `User`(`groupId`);
CREATE UNIQUE INDEX `User_groupId_listNumber_key` ON `User`(`groupId`, `listNumber`);

-- Actividades por grupo
ALTER TABLE `Activity` ADD COLUMN `groupId` VARCHAR(191) NOT NULL;

CREATE INDEX `Activity_groupId_idx` ON `Activity`(`groupId`);

-- Relaciones
ALTER TABLE `ClassGroup` ADD CONSTRAINT `ClassGroup_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `User` ADD CONSTRAINT `User_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Activity` ADD CONSTRAINT `Activity_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
