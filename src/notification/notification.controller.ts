import { Request, Response } from 'express';

// Notification Controller
// req/res 처리만 담당한다. 실제 로직은 추후 notificationService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getNotifications = (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ code: 200, message: '알림 목록 조회 (미구현)', data: { notifications: [], unreadCount: 0 } });
};

export const readNotification = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '알림 읽음 처리 (미구현)', data: null });
};

export const deleteNotification = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '알림 개별 삭제 (미구현)', data: null });
};

export const deleteAllNotifications = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '알림 전체 삭제 (미구현)', data: null });
};
