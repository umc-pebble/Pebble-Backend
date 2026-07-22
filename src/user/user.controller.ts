import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { userService } from './user.service';
import { parseId } from '../utils/params';
import {
  UpdateMeBody,
  UpdateSettingsBody,
  ChangePasswordBody,
  RequestEmailChangeBody,
  ConfirmEmailChangeBody,
} from './user.schema';

// User Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.
// body 검증은 라우트의 validateBody(user.schema) 미들웨어가 이미 마친 상태다.

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.userId!);
    sendSuccess(res, profile, '프로필 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dto = req.body as UpdateMeBody;
    const profile = await userService.updateProfile(req.userId!, dto);
    sendSuccess(res, profile, '프로필 수정 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userService.withdraw(req.userId!);
    sendSuccess(res, null, '회원탈퇴가 완료되었습니다.');
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requesterId = req.userId!;
    const targetUserId = parseId(req.params.userId, '사용자');
    const profile = await userService.getUserProfileById(requesterId, targetUserId);
    sendSuccess(res, profile, '프로필 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await userService.getSettings(req.userId!);
    sendSuccess(res, settings, '설정 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dto = req.body as UpdateSettingsBody;
    const settings = await userService.updateSettings(req.userId!, dto);
    sendSuccess(res, settings, '설정 변경 성공');
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dto = req.body as ChangePasswordBody;
    const tokens = await userService.changePassword(req.userId!, dto);
    sendSuccess(res, tokens, '비밀번호 변경 성공');
  } catch (err) {
    next(err);
  }
};

export const requestEmailChange = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { newEmail } = req.body as RequestEmailChangeBody;
    await userService.requestEmailChange(req.userId!, newEmail);
    sendSuccess(res, null, '인증 링크를 발송했습니다. 이메일을 확인해주세요.');
  } catch (err) {
    next(err);
  }
};

export const confirmEmailChange = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body as ConfirmEmailChangeBody;
    const profile = await userService.confirmEmailChange(req.userId!, token);
    sendSuccess(res, profile, '이메일이 변경되었습니다.');
  } catch (err) {
    next(err);
  }
};
