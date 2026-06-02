-- Alumnos: número de control como usuario y contraseña creada por ellos
ALTER TABLE `User` DROP INDEX `User_groupId_listNumber_key`;
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `controlNumber` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `passwordSet` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `recoverablePassword` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_controlNumber_key` ON `User`(`controlNumber`);

-- Docentes siempre con contraseña activa
UPDATE `User` SET `passwordSet` = true WHERE `role` = 'TEACHER';

-- Alumnos que ya tenían correo de acceso previo
UPDATE `User` SET `passwordSet` = true WHERE `role` = 'STUDENT' AND `email` IS NOT NULL;
