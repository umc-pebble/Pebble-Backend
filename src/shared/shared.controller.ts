import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';

// SharedCategory Controller
// req/res 처리만 담당. 실제 로직은 추후 sharedService로 위임 예정. (P2 후속)
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const shareCategory = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 카테고리 전환 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const inviteMember = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 멤버 추가 초대 (미구현)', 201);
  } catch (err) {
    next(err);
  }
};

export const getMembers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 멤버 목록 조회 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const respondInvite = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 초대 수락/거절 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const leaveSharedCategory = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 카테고리 자진 탈퇴 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 멤버 강퇴 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const deleteSharedCategory = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '공유 카테고리 삭제 (미구현)');
  } catch (err) {
    next(err);
  }
};
