import { Request, Response } from 'express';

// Activity(징검다리) Controller
// req/res 처리만 담당한다. 실제 로직은 추후 activityService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getMyGrass = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '내 징검다리 조회 (미구현)', data: { grass: [] } });
};

export const getFriendGrass = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '친구 징검다리 조회 (미구현)', data: { grass: [] } });
};
