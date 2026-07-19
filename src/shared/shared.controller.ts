import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sharedService } from './shared.service';
import { ShareCategoryBody, InviteMemberBody, RespondInviteBody } from './shared.schema';

// SharedCategory Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.
// body 검증은 라우트의 validateBody(shared.schema) 미들웨어가 이미 마친 상태다.

// 경로 파라미터를 양의 정수로 검증한다. (body가 아니므로 컨트롤러에서 처리)
function parseId(raw: string, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', `유효하지 않은 ${label} ID입니다.`);
  }
  return id;
}

export const shareCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const { invites } = req.body as ShareCategoryBody;
    const members = await sharedService.shareCategory(req.userId!, categoryId, invites);
    sendSuccess(res, members, '전환·초대 완료');
  } catch (err) {
    next(err);
  }
};

export const inviteMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const target = req.body as InviteMemberBody;
    const member = await sharedService.inviteMember(req.userId!, categoryId, target);
    sendSuccess(res, member, '초대 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const getMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const members = await sharedService.getMembers(req.userId!, categoryId);
    sendSuccess(res, members, '조회 성공');
  } catch (err) {
    next(err);
  }
};

export const respondInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const { action } = req.body as RespondInviteBody;
    await sharedService.respondInvite(req.userId!, categoryId, action);
    const message = action === 'ACCEPT' ? '초대를 수락했습니다.' : '초대를 거절했습니다.';
    sendSuccess(res, null, message);
  } catch (err) {
    next(err);
  }
};

export const leaveSharedCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    await sharedService.leaveSharedCategory(req.userId!, categoryId);
    sendSuccess(res, null, '공유 카테고리에서 나갔습니다.');
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const targetUserId = parseId(req.params.userId, '유저');
    await sharedService.removeMember(req.userId!, categoryId, targetUserId);
    sendSuccess(res, null, '강퇴 완료');
  } catch (err) {
    next(err);
  }
};

export const deleteSharedCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    await sharedService.deleteSharedCategory(req.userId!, categoryId);
    sendSuccess(res, null, '삭제 완료');
  } catch (err) {
    next(err);
  }
};
