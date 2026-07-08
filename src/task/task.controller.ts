import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Task Controller
// req/res 처리만 담당. 실제 로직은 추후 taskService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getTasks = (_req: Request, res: Response) => {
  sendSuccess(res, { tasks: [] }, '종속 태스크 목록 조회 (미구현)');
};

export const createTask = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 생성 (미구현)', 201);
};

export const updateTask = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 수정 (미구현)');
};

export const toggleTaskComplete = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 완료 토글 (미구현)');
};

export const deleteTask = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 삭제 (미구현)');
};

export const reorderTasks = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 순서 변경 (미구현)');
};