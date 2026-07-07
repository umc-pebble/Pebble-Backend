import { Request, Response } from 'express';

// Follow Controller
// req/res 처리만 담당한다. 실제 로직은 추후 followService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const searchUsers = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '유저 검색 (미구현)', data: { users: [] } });
};

export const requestFollow = (_req: Request, res: Response) => {
  res.status(201).json({ code: 201, message: '팔로우 요청 (미구현)', data: null });
};

export const getFollows = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '팔로우 목록 조회 (미구현)', data: { follows: [] } });
};

export const respondFollow = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '팔로우 요청 처리 (미구현)', data: null });
};

export const unfollow = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '팔로잉 취소 (미구현)', data: null });
};
