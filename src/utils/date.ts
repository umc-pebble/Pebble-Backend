// KST(Asia/Seoul) 기준 "오늘" 날짜를 반환한다. @db.Date 컬럼(UTC 자정 기준 저장)과 그대로
// 비교할 수 있도록 UTC 자정 Date로 만든다 (activity.service.ts의 날짜 변환 방식과 동일).
export function getTodayKST(): Date {
  const kstDateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = kstDateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
