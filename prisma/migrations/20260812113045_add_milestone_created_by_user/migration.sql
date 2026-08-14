-- AlterTable
ALTER TABLE `Milestone` ADD COLUMN `createdByUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Milestone_createdByUserId_idx` ON `Milestone`(`createdByUserId`);

-- AddForeignKey
ALTER TABLE `Milestone` ADD CONSTRAINT `Milestone_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 행 백필: 상위 카테고리의 오너를 작성자로 넣는다.
-- 개인 카테고리(isShared=0)는 오너 외에 마일스톤을 만들 수 있는 사람이 없어 이 값이 정확하다.
-- 공유 카테고리는 다른 멤버가 만들었을 수 있어 추정값이지만, 이 마이그레이션 시점의 데이터가
-- 테스트 계정뿐이라 그대로 채운다. 비워두면 기존 행이 영구히 "작성자 미상"으로 남는다.
UPDATE `Milestone` m
  JOIN `Category` c ON c.id = m.categoryId
  SET m.createdByUserId = c.userId
  WHERE m.createdByUserId IS NULL;
