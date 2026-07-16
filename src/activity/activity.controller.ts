import { NextFunction, Response } from 'express';
import { activityService } from './activity.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getActivityByUserId = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requesterId = req.userId;
    const targetUserId = Number(req.params.userId);
    const baseDate =
      typeof req.query.baseDate === 'string'
        ? req.query.baseDate
        : undefined;

    if (requesterId === undefined) {
      throw new AppError(
        'COMMON_UNAUTHORIZED',
        '인증 정보가 없습니다.',
      );
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '유효하지 않은 사용자 ID입니다.',
      );
    }

    const result =
      await activityService.getActivityByUserId(
        requesterId,
        targetUserId,
        baseDate,
      );

    sendSuccess(res, result, '요청 성공');
  } catch (error) {
    next(error);
  }
};