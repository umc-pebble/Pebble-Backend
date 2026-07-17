import { NextFunction, Response } from 'express';
import { activityService } from './activity.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getActivityByUserId = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requesterId = req.userId!;
    const targetUserId = Number(req.params.userId);
    const baseDate =
      typeof req.query.baseDate === 'string'
        ? req.query.baseDate
        : undefined;

    const result = await activityService.getActivityByUserId(
        requesterId,
        targetUserId,
        baseDate,
      );

    sendSuccess(res, result, '요청 성공');
  } catch (error) {
    next(error);
  }
};