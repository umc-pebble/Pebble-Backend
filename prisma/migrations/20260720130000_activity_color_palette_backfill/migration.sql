-- Backfill: PLB-026 팔레트 확정 전(hex 정규식만 검증하던 시절)에 저장된, 6개 확정 팔레트 밖의
-- 레거시 activityColor 값을 전부 기본색(#A3A3A3, 조약돌)으로 이관한다. (#43)
-- 이전 마이그레이션(20260718201422_activity_color_default_gray)의 #FFFFFF 전용 백필보다
-- 조건을 넓혀, 팔레트 밖 값 전체를 대상으로 한다.
UPDATE `User`
SET `activityColor` = '#A3A3A3'
WHERE `activityColor` NOT IN ('#A3A3A3', '#82A0FF', '#ABE692', '#FFE48B', '#FFB67A', '#FFB4B4');
