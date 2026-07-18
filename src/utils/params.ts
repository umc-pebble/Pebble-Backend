import { AppError } from './app-error';

// 경로 파라미터를 양의 정수로 검증한다. (body가 아니므로 컨트롤러에서 처리)
export function parseId(raw: string, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', `유효하지 않은 ${label} ID입니다.`);
  }
  return id;
}

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// 쿼리 파라미터 offset/limit을 파싱한다. (body가 아니므로 컨트롤러에서 처리)
// 음수·NaN 등 잘못된 값은 기본값으로 대체한다(쿼리 파라미터는 필수가 아니므로 400 대신 관대하게 처리).
// limit은 과도한 조회로 인한 부하를 막기 위해 MAX_LIMIT으로 상한을 둔다.
export function parsePagination(offsetRaw: unknown, limitRaw: unknown) {
  const offsetNum = Number(offsetRaw);
  const limitNum = Number(limitRaw);
  const offset = Number.isInteger(offsetNum) && offsetNum >= 0 ? offsetNum : DEFAULT_OFFSET;
  const limit =
    Number.isInteger(limitNum) && limitNum > 0 ? Math.min(limitNum, MAX_LIMIT) : DEFAULT_LIMIT;
  return { offset, limit };
}
