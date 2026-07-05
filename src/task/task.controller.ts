import { Request, Response } from 'express';

// Task Controller
// req/res 처리만 담당. 실제 로직은 추후 taskService로 위임 예정.
// 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getTasks = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '종속 태스크 목록 조회 (미구현)', data: { tasks: [] } });
};

export const createTask = (_req: Request, res: Response) => {
  res.status(201).json({ code: 201, message: '태스크 생성 (미구현)', data: null });
};

export const updateTask = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '태스크 수정 (미구현)', data: null });
};

export const toggleTaskComplete = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '태스크 완료 토글 (미구현)', data: null });
};

export const deleteTask = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '태스크 삭제 (미구현)', data: null });
};

export const reorderTasks = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '태스크 순서 변경 (미구현)', data: null });
};
