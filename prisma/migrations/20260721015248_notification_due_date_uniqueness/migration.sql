-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `dueDate` DATE NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Notification_userId_type_relatedId_dueDate_key` ON `Notification`(`userId`, `type`, `relatedId`, `dueDate`);
