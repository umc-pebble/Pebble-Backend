-- AlterTable
ALTER TABLE `Task` ADD COLUMN `completedByUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `TaskDate` ADD COLUMN `completedByUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Task_completedByUserId_idx` ON `Task`(`completedByUserId`);

-- CreateIndex
CREATE INDEX `TaskDate_completedByUserId_idx` ON `TaskDate`(`completedByUserId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_completedByUserId_fkey` FOREIGN KEY (`completedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDate` ADD CONSTRAINT `TaskDate_completedByUserId_fkey` FOREIGN KEY (`completedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
