import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Notification Controller
// req/res 처리만 담당한다. 실제 로직은 추후 notificationService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getNotifications = (_req: Request, res: Response) => {
  sendSuccess(res, { notifications: [], unreadCount: 0 }, '알림 목록 조회 (미구현)');
};

export const readNotification = (_req: Request, res: Response) => {
  sendSuccess(res, null, '알림 읽음 처리 (미구현)');
};

export const deleteNotification = (_req: Request, res: Response) => {
  sendSuccess(res, null, '알림 개별 삭제 (미구현)');
};

export const deleteAllNotifications = (_req: Request, res: Response) => {
  sendSuccess(res, null, '알림 전체 삭제 (미구현)');
};