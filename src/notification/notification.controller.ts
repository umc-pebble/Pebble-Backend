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
