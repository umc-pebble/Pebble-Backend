-- AlterTable
ALTER TABLE `Task` ADD COLUMN `categoryId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Task_categoryId_startDate_idx` ON `Task`(`categoryId`, `startDate`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
