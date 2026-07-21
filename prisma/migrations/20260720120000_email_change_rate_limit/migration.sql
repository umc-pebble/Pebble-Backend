-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailChangeLastRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `emailChangeRequestCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `emailChangeRequestWindowStart` DATETIME(3) NULL;
