-- AlterTable
ALTER TABLE `Milestone` DROP COLUMN `repeatDays`,
    MODIFY `dateType` ENUM('SINGLE', 'RANGE', 'MULTIPLE') NOT NULL;

-- AlterTable
ALTER TABLE `Task` DROP COLUMN `repeatDays`,
    MODIFY `dateType` ENUM('SINGLE', 'RANGE', 'MULTIPLE') NOT NULL;
