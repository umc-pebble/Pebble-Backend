import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';

import { authService } from './auth.service';

// Auth Controller
// req/res 처리만 담당하고 비즈니스 로직은 authService에 위임한다.
// Express 4는 async 에러를 자동 전파하지 않으므로 try/catch + next(err) 시그니처를 유지한다.

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.signup(req.body);
    sendSuccess(res, result, '회원가입 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, '로그인 성공');
  } catch (err) {
    next(err);
  }
};

// 소셜 로그인은 OAuth 클라이언트 키 발급 후 별도 이슈에서 구현 예정
export const socialLogin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '소셜 로그인 (미구현)');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, result, '토큰 재발급 성공');
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.userId);
    sendSuccess(res, null, '로그아웃 성공');
  } catch (err) {
    next(err);
  }
};

// 임시 비밀번호 발급은 이메일 발송(Resend) 연동과 함께 이슈 #13에서 구현 예정
export const issueTempPassword = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '임시 비밀번호 발급 (미구현)');
  } catch (err) {
    next(err);
  }
};
