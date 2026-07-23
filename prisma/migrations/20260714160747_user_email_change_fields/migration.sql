-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailChangeTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `emailChangeTokenHash` VARCHAR(255) NULL,
    ADD COLUMN `pendingEmail` VARCHAR(255) NULL;
