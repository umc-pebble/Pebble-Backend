import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { notificationService } from './notification.service';

// Notification Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 20;

// 경로 파라미터(notificationId)를 양의 정수로 검증한다.
function parseNotificationId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', '유효하지 않은 알림 ID입니다.');
  }
  return id;
}

// 음수·NaN 등 잘못된 값은 기본값으로 대체한다(쿼리 파라미터는 필수가 아니므로 400 대신 관대하게 처리).
function parsePagination(req: AuthRequest) {
  const offsetRaw = Number(req.query.offset);
  const limitRaw = Number(req.query.limit);
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : DEFAULT_OFFSET;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT;
  return { offset, limit };
}

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { offset, limit } = parsePagination(req);
    const data = await notificationService.getNotifications(req.userId!, offset, limit);
    sendSuccess(res, data, '알림 목록 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const readNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseNotificationId(req.params.notificationId);
    const data = await notificationService.readNotification(req.userId!, notificationId);
    sendSuccess(res, data, '읽음 처리 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseNotificationId(req.params.notificationId);
    await notificationService.deleteNotification(req.userId!, notificationId);
    sendSuccess(res, null, '알림 삭제 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteAllNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await notificationService.deleteAllNotifications(req.userId!);
    sendSuccess(res, null, '알림 전체 삭제 성공');
  } catch (err) {
    next(err);
  }
};
