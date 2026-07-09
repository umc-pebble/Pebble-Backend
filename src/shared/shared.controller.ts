import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// SharedCategory Controller
// req/res 처리만 담당. 실제 로직은 추후 sharedService로 위임 예정. (P2 후속)
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const shareCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 카테고리 전환 (미구현)');
};

export const inviteMember = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 멤버 추가 초대 (미구현)', 201);
};

export const respondInvite = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 초대 수락/거절 (미구현)');
};

export const leaveSharedCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 카테고리 자진 탈퇴 (미구현)');
};

export const removeMember = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 멤버 강퇴 (미구현)');
};

export const deleteSharedCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '공유 카테고리 삭제 (미구현)');
};