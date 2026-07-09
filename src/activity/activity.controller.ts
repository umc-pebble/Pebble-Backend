import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Activity(징검다리) Controller
// req/res 처리만 담당한다. 실제 로직은 추후 activityService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getMyGrass = (_req: Request, res: Response) => {
  sendSuccess(res, { grass: [] }, '내 징검다리 조회 (미구현)');
};

export const getFriendGrass = (_req: Request, res: Response) => {
  sendSuccess(res, { grass: [] }, '친구 징검다리 조회 (미구현)');
};