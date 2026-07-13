import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';

// Auth Controller
// req/res 처리만 담당한다. 실제 로직은 추후 authService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.
// Express 4는 async 에러를 자동 전파하지 않으므로 try/catch + next(err) 시그니처를 유지한다.

export const signup = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '회원가입 (미구현)', 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '로그인 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const socialLogin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '소셜 로그인 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '토큰 재발급 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '로그아웃 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const issueTempPassword = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '임시 비밀번호 발급 (미구현)');
  } catch (err) {
    next(err);
  }
};
