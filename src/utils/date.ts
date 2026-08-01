import { AppError } from './app-error';

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

// baseDate(YYYY-MM-DD)가 속한 달을 [monthStart, nextMonthStart) 반개구간으로 바꾼다.
// 생략하면 KST 기준 오늘이 속한 달을 쓴다.
//
// 형식·기본값·에러 문구를 GET /tasks의 baseDate 처리(task.service.ts의 parseBaseDate)와 의도적으로
// 동일하게 맞췄다. 프론트가 월별 화면을 조립할 때 같은 baseDate 값을 태스크·마일스톤 두 조회에
// 그대로 넘기는데, 한쪽만 파싱 규칙이 다르면 같은 요청이 서로 다른 달을 가리키게 된다.
// 반환 Date는 @db.Date 컬럼과 같은 UTC 자정 기준이라 날짜 비교에 바로 쓸 수 있다.
export function getMonthRangeKST(baseDate?: string): {
  monthStart: Date;
  nextMonthStart: Date;
} {
  const base = baseDate ?? toDateStringKST(getTodayKST());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    throw new AppError('COMMON_INVALID_INPUT', 'baseDate는 YYYY-MM-DD 형식이어야 합니다.');
  }

  const [year, month, day] = base.split('-').map(Number);
  // Date.UTC는 2026-02-30 같은 값을 3월로 넘겨 조용히 받아들이므로, 되돌려 비교해 걸러낸다.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isValid) {
    throw new AppError('COMMON_INVALID_INPUT', '유효하지 않은 baseDate입니다.');
  }

  // 12월이면 month가 12라 Date.UTC(year, 12, 1)이 되는데, 이는 다음 해 1월로 정규화되므로
  // 연말 경계를 따로 분기할 필요가 없다.
  return {
    monthStart: new Date(Date.UTC(year, month - 1, 1)),
    nextMonthStart: new Date(Date.UTC(year, month, 1)),
  };
}

// @db.Date 값은 UTC 자정 기준이라 ISO 문자열 앞 10자리가 곧 그 날짜다.
function toDateStringKST(date: Date): string {
  return date.toISOString().slice(0, 10);
}
