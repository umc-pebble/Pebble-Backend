import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';

// Follow Controller
// req/res 처리만 담당한다. 실제 로직은 추후 followService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.
// Express 4는 async 에러를 자동 전파하지 않으므로 try/catch + next(err) 시그니처를 유지한다.

export const searchUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, [], '유저 검색 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const requestFollow = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '팔로우 요청 (미구현)', 201);
  } catch (err) {
    next(err);
  }
};

export const getFollows = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, [], '팔로우 목록 조회 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const acceptFollow = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '팔로우 수락 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const deleteFollow = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '팔로우 거절/취소/언팔 (미구현)');
  } catch (err) {
    next(err);
  }
};
