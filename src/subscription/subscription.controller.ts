import { Request, Response } from 'express';

// Subscription Controller
// req/res 처리만 담당한다. 실제 로직은 추후 subscriptionService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getMySubscription = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '구독 상태 조회 (미구현)', data: null });
};

export const verifySubscription = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: 'IAP 영수증 검증 (미구현)', data: null });
};
