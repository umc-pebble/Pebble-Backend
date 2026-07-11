import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Auth Controller
// req/res 처리만 담당한다. 실제 로직은 추후 authService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const signup = (_req: Request, res: Response) => {
  sendSuccess(res, null, '회원가입 (미구현)', 201);
};

export const login = (_req: Request, res: Response) => {
  sendSuccess(res, null, '로그인 (미구현)');
};

export const socialLogin = (_req: Request, res: Response) => {
  sendSuccess(res, null, '소셜 로그인 (미구현)');
};

export const refresh = (_req: Request, res: Response) => {
  sendSuccess(res, null, '토큰 재발급 (미구현)');
};

export const logout = (_req: Request, res: Response) => {
  sendSuccess(res, null, '로그아웃 (미구현)');
};

export const issueTempPassword = (_req: Request, res: Response) => {
  sendSuccess(res, null, '임시 비밀번호 발급 (미구현)');
};