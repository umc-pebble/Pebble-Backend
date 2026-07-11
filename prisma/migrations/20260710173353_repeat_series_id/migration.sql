/*
  Warnings:

  - You are about to drop the `MilestoneException` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskException` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `MilestoneException` DROP FOREIGN KEY `MilestoneException_milestoneId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskException` DROP FOREIGN KEY `TaskException_taskId_fkey`;

-- AlterTable
ALTER TABLE `Milestone` ADD COLUMN `seriesId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `seriesId` INTEGER NULL;

-- DropTable
DROP TABLE `MilestoneException`;

-- DropTable
DROP TABLE `TaskException`;

-- CreateIndex
CREATE INDEX `Milestone_seriesId_idx` ON `Milestone`(`seriesId`);

-- CreateIndex
CREATE INDEX `Task_seriesId_idx` ON `Task`(`seriesId`);
