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

export const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.socialLogin(req.params.provider, req.body);
    // 이번 요청으로 계정이 생성됐으면 201, 기존 계정 로그인이면 200 (스웨거 계약)
    const { isNewUser } = result;
    sendSuccess(
      res,
      result,
      isNewUser ? '소셜 회원가입 성공' : '소셜 로그인 성공',
      isNewUser ? 201 : 200,
    );
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

export const issueTempPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.issueTempPassword(req.body.email);
    // 가입 여부·rate limit과 무관하게 항상 동일 응답 (계정 존재 노출 방지, PLB-047)
    sendSuccess(res, null, '입력하신 이메일로 임시 비밀번호를 발송했어요.');
  } catch (err) {
    next(err);
  }
};
