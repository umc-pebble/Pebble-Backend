-- 1. 새 유니크 인덱스를 먼저 생성 (이제 FK가 기댈 인덱스가 2개 존재)
CREATE UNIQUE INDEX `Report_userId_month_key` ON `Report`(`userId`, `month`);

-- 2. 그 다음에 옛날 인덱스 삭제 (FK는 여전히 위에서 만든 인덱스로 커버됨)
DROP INDEX `Report_userId_month_idx` ON `Report`;

-- 3. 나머지 컬럼 변경들 (statsData 추가, reportImageUrl nullable 등)
ALTER TABLE `Report` MODIFY COLUMN `reportImageUrl` VARCHAR(500) NULL;
ALTER TABLE `Report` ADD COLUMN `statsData` JSON NULL;