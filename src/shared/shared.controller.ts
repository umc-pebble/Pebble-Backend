import { Request, Response } from 'express';

// SharedCategory Controller
// req/res 처리만 담당. 실제 로직은 추후 sharedService로 위임 예정. (P2 후속)
// 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const shareCategory = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '공유 카테고리 전환 (미구현)', data: null });
};

export const removeMember = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '공유 멤버 강퇴 (미구현)', data: null });
};

export const unshareCategory = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '공유 카테고리 삭제 (미구현)', data: null });
};
