import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { parseId, parsePagination } from '../utils/params';
import { AuthRequest } from '../middlewares/auth.middleware';
import { notificationService } from './notification.service';

// Notification Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { offset, limit } = parsePagination(req.query.offset, req.query.limit);
    const data = await notificationService.getNotifications(req.userId!, offset, limit);
    sendSuccess(res, data, '알림 목록 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const readNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseId(req.params.notificationId, '알림');
    const data = await notificationService.readNotification(req.userId!, notificationId);
    sendSuccess(res, data, '읽음 처리 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseId(req.params.notificationId, '알림');
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

// QA/개발 편의용 수동 트리거. 실제 서비스에서는 notification.scheduler.ts의 cron(매일 00:00 KST)이
// 알아서 호출하므로 이 엔드포인트를 쓸 필요가 없다 — Swagger 문서에도 의도적으로 올리지 않는다.
export const triggerDailyDueBatch = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await notificationService.generateDailyDueNotifications();
    sendSuccess(res, result, '당일 마감 알림 배치 실행 완료 (QA용)');
  } catch (err) {
    next(err);
  }
};
