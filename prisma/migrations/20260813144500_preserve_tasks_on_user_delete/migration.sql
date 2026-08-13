-- Preserve tasks created by a user after that user account is deleted.
ALTER TABLE `Task` DROP FOREIGN KEY `Task_userId_fkey`;
ALTER TABLE `Task` MODIFY `userId` INTEGER NULL;
ALTER TABLE `Task`
  ADD CONSTRAINT `Task_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
