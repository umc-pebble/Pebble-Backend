/*
  Warnings:

  - You are about to drop the column `memo` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `seriesId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `taskTime` on the `task` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Task_seriesId_idx` ON `Task`;

-- AlterTable
ALTER TABLE `Task` DROP COLUMN `memo`,
    DROP COLUMN `seriesId`,
    DROP COLUMN `taskTime`,
    MODIFY `startDate` DATE NULL;

-- CreateTable
CREATE TABLE `TaskDate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskDate_taskId_date_idx`(`taskId`, `date`),
    UNIQUE INDEX `TaskDate_taskId_date_key`(`taskId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskException` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskDateId` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `color` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskException_taskDateId_key`(`taskDateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskDate` ADD CONSTRAINT `TaskDate_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskException` ADD CONSTRAINT `TaskException_taskDateId_fkey` FOREIGN KEY (`taskDateId`) REFERENCES `TaskDate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
