import { Request, Response } from 'express';

// Auth Controller
// req/res 처리만 담당한다. 실제 로직은 추후 authService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const signup = (_req: Request, res: Response) => {
  res.status(201).json({ code: 201, message: '회원가입 (미구현)', data: null });
};

export const login = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '로그인 (미구현)', data: null });
};

export const googleLogin = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '구글 소셜 로그인 (미구현)', data: null });
};

export const naverLogin = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '네이버 소셜 로그인 (미구현)', data: null });
};

export const refresh = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '토큰 재발급 (미구현)', data: null });
};

export const logout = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '로그아웃 (미구현)', data: null });
};

export const requestPasswordReset = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '비밀번호 재설정 링크 발송 (미구현)', data: null });
};

export const resetPassword = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '비밀번호 재설정 확정 (미구현)', data: null });
};
