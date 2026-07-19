import { AppError } from './app-error';

// 경로 파라미터를 양의 정수로 검증한다. (body가 아니므로 컨트롤러에서 처리)
export function parseId(raw: string, label: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', `유효하지 않은 ${label} ID입니다.`);
  }
  return id;
}
