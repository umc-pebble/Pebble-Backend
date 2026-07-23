-- AlterTable
ALTER TABLE `User` MODIFY `activityColor` VARCHAR(20) NOT NULL DEFAULT '#A3A3A3';

-- Backfill: PLB-026 팔레트 확정 전 기본값이었던 #FFFFFF는 새 팔레트에 없으므로 새 기본값으로 이관
UPDATE `User` SET `activityColor` = '#A3A3A3' WHERE `activityColor` = '#FFFFFF';
