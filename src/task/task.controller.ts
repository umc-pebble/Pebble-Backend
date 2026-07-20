import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { taskService } from './task.service';

export const getTasks = (_req: Request, res: Response) => {
  sendSuccess(res, { tasks: [] }, '종속 태스크 목록 조회 (미구현)');
};

export const createTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;
    const result = await taskService.createTask(userId, req.body);
    sendSuccess(res, result, '태스크 생성 성공', 201);
  } catch (error) {
    next(error);
  }
};

export const updateTask = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 수정 (미구현)');
};

export const toggleTaskComplete = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 완료 토글 (미구현)');
};

export const deleteTask = (
  req: AuthRequest,
  res: Response,
) => {
  sendSuccess(res, null, '태스크 삭제 (미구현)');
};

export const reorderTasks = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 순서 변경 (미구현)');
};