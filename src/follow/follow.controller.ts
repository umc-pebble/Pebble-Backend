import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Follow Controller
// req/res 처리만 담당한다. 실제 로직은 추후 followService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const searchUsers = (_req: Request, res: Response) => {
  sendSuccess(res, { users: [] }, '유저 검색 (미구현)');
};

export const requestFollow = (_req: Request, res: Response) => {
  sendSuccess(res, null, '팔로우 요청 (미구현)', 201);
};

export const getFollows = (_req: Request, res: Response) => {
  sendSuccess(res, { follows: [] }, '팔로우 목록 조회 (미구현)');
};

export const respondFollow = (_req: Request, res: Response) => {
  sendSuccess(res, null, '팔로우 요청 처리 (미구현)');
};

export const unfollow = (_req: Request, res: Response) => {
  sendSuccess(res, null, '팔로잉 취소 (미구현)');
};