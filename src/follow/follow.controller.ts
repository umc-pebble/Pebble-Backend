import { Response, NextFunction } from 'express';

import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';

import { followService } from './follow.service';
import { SearchUsersQuery, FollowListQuery } from './follow.schema';

// Follow Controller
// req/res 처리만 담당하고 비즈니스 로직은 followService에 위임한다.
// Express 4는 async 에러를 자동 전파하지 않으므로 try/catch + next(err) 시그니처를 유지한다.

// 인증 미들웨어를 통과했으면 userId가 항상 존재하지만, 타입 보장을 위해 확인한다.
const requireUserId = (req: AuthRequest) => {
  if (req.userId === undefined) {
    throw new AppError('COMMON_UNAUTHORIZED', '인증 정보가 없습니다.');
  }
  return req.userId;
};

// 경로 파라미터는 문자열이므로 숫자로 변환·검증한다.
const parseFollowId = (value: string) => {
  const followId = Number(value);
  if (!Number.isInteger(followId) || followId <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', '유효하지 않은 followId입니다.');
  }
  return followId;
};

export const searchUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { data, page } = await followService.searchUsers(
      userId,
      req.query as unknown as SearchUsersQuery,
    );
    sendPaginated(res, data, page, '요청 성공');
  } catch (err) {
    next(err);
  }
};

export const requestFollow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const result = await followService.requestFollow(userId, req.body.targetUserId);
    sendSuccess(res, result, '팔로우 요청 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const getFollows = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { data, page } = await followService.getFollows(
      userId,
      req.query as unknown as FollowListQuery,
    );
    sendPaginated(res, data, page, '요청 성공');
  } catch (err) {
    next(err);
  }
};

export const acceptFollow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const result = await followService.acceptFollow(userId, parseFollowId(req.params.followId));
    sendSuccess(res, result, '팔로우 수락');
  } catch (err) {
    next(err);
  }
};

export const deleteFollow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    await followService.deleteFollow(userId, parseFollowId(req.params.followId));
    sendSuccess(res, null, '처리 완료');
  } catch (err) {
    next(err);
  }
};
