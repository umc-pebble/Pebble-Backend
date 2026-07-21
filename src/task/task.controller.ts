import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { taskService } from './task.service';

export const getTasks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.userId!;
        const baseDate =req.query.baseDate !== undefined? String(req.query.baseDate) : undefined;
        const result = await taskService.getTasks( userId,baseDate);

        sendSuccess(
            res,
            result,
            '월별 태스크 조회 성공',
            200,
        );
    } catch (error) {
        next(error);
    }
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

export const updateTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;
    const taskId = Number(req.params.taskId);

    const result = await taskService.updateTask(
      userId,
      taskId,
      req.body,
    );

    sendSuccess(
      res,
      result,
      '태스크 수정 성공',
      200,
    );
  } catch (error) {
    next(error);
  }
};

export const toggleTaskComplete = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;
    const taskId = Number(req.params.taskId);

    const taskDateId =
      req.query.taskDateId !== undefined
        ? Number(req.query.taskDateId)
        : undefined;

    const result = await taskService.toggleTaskComplete(
      userId,
      taskId,
      taskDateId,
    );

    sendSuccess(
      res,
      result,
      '완료 처리 성공',
      200,
    );
  } catch (error) {
    next(error);
  }
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

export const reorderTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;

    const result = await taskService.reorderTasks(
      userId,
      req.body,
    );

    sendSuccess(
      res,
      result,
      '순서 변경 성공',
      200,
    );
  } catch (error) {
    next(error);
  }
};

export const getFriendTasks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        const requesterId = req.userId!;
        const targetUserId = Number(req.params.userId);

        const baseDate =
            req.query.baseDate !== undefined
                ? String(req.query.baseDate)
                : undefined;

        const result =
            await taskService.getFriendTasks(
                requesterId,
                targetUserId,
                baseDate,
            );

        sendSuccess(
            res,
            result,
            '친구 태스크 조회 성공',
            200,
        );
    } catch (error) {
        next(error);
    }
};