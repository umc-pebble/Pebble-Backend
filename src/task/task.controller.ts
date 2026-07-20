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

export const deleteTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;
    const taskId = Number(req.params.taskId);

    const deleteScope =
      req.query.deleteScope !== undefined
        ? String(req.query.deleteScope)
        : undefined;

    const taskDateId =
      req.query.taskDateId !== undefined
        ? Number(req.query.taskDateId)
        : undefined;

    const result = await taskService.deleteTask(
      userId,
      taskId,
      deleteScope,
      taskDateId,
    );

    const message =
      deleteScope === 'THIS_ONLY' || deleteScope === 'ALL'
        ? '태스크 회차 삭제 성공'
        : '태스크 삭제 성공';

    sendSuccess(res, result, message, 200);
  } catch (error) {
    next(error);
  }
};

export const reorderTasks = (_req: Request, res: Response) => {
  sendSuccess(res, null, '태스크 순서 변경 (미구현)');
};