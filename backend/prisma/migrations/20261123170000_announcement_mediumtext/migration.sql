-- El reporte diario ya no cabe en TEXT (64 KB) cuando varios equipos llenan varios días.
ALTER TABLE `Announcement` MODIFY `body` MEDIUMTEXT NOT NULL;
