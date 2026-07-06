import { Request, Response } from 'express';

// Milestone Controller
// req/res 처리만 담당. 실제 로직은 추후 milestoneService로 위임 예정.
// 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getMilestones = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '마일스톤 목록 조회 (미구현)', data: { milestones: [] } });
};

export const createMilestone = (_req: Request, res: Response) => {
  res.status(201).json({ code: 201, message: '마일스톤 생성 (미구현)', data: null });
};

export const updateMilestone = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '마일스톤 수정 (미구현)', data: null });
};

export const deleteMilestone = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '마일스톤 삭제 (미구현)', data: null });
};

export const reorderMilestones = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '마일스톤 순서 변경 (미구현)', data: null });
};
