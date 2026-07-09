import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// User Controller
// req/res 처리만 담당한다. 실제 로직은 추후 userService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getMe = (_req: Request, res: Response) => {
  sendSuccess(res, null, '내 프로필 조회 (미구현)');
};

export const updateMe = (_req: Request, res: Response) => {
  sendSuccess(res, null, '프로필 편집 (미구현)');
};

export const deleteMe = (_req: Request, res: Response) => {
  sendSuccess(res, null, '회원탈퇴 (미구현)');
};

export const getUser = (_req: Request, res: Response) => {
  sendSuccess(res, null, '타인 프로필 조회 (미구현)');
};

export const getSettings = (_req: Request, res: Response) => {
  sendSuccess(res, null, '설정 조회 (미구현)');
};

export const updateSettings = (_req: Request, res: Response) => {
  sendSuccess(res, null, '설정 수정 (미구현)');
};

export const changePassword = (_req: Request, res: Response) => {
  sendSuccess(res, null, '비밀번호 변경 (미구현)');
};

export const requestEmailChange = (_req: Request, res: Response) => {
  sendSuccess(res, null, '이메일 변경 인증 링크 발송 (미구현)');
};

export const confirmEmailChange = (_req: Request, res: Response) => {
  sendSuccess(res, null, '이메일 변경 확정 (미구현)');
};