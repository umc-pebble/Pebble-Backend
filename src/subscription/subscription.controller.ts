import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Subscription Controller
// req/res 처리만 담당한다. 실제 로직은 추후 subscriptionService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getMySubscription = (_req: Request, res: Response) => {
  sendSuccess(res, null, '구독 상태 조회 (미구현)');
};

export const verifySubscription = (_req: Request, res: Response) => {
  sendSuccess(res, null, 'IAP 영수증 검증 (미구현)');
};