-- AlterTable
ALTER TABLE `SharedCategoryMember` ADD COLUMN `acceptedAt` DATETIME(3) NULL;

-- 기존 ACCEPTED 행 백필: 정확한 수락 시각은 남아있지 않으므로 updatedAt(마지막 상태 변경 시각)을
-- 최선의 추정값으로 채운다. 비워두면 오너 이관 시 후계자 선정(acceptedAt 오름차순)에서
-- 이 행들이 NULL로 최상단에 잘못 정렬된다. PENDING 행은 아직 수락 전이라 그대로 NULL로 둔다.
UPDATE `SharedCategoryMember`
  SET `acceptedAt` = `updatedAt`
  WHERE `status` = 'ACCEPTED' AND `acceptedAt` IS NULL;
