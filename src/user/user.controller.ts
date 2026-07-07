import { Request, Response } from 'express';

// User Controller
// req/res 처리만 담당한다. 실제 로직은 추후 userService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getMe = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '내 프로필 조회 (미구현)', data: null });
};

export const updateMe = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '프로필 편집 (미구현)', data: null });
};

export const deleteMe = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '회원탈퇴 (미구현)', data: null });
};

export const getUser = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '타인 프로필 조회 (미구현)', data: null });
};

export const getSettings = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '설정 조회 (미구현)', data: null });
};

export const updateSettings = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '설정 수정 (미구현)', data: null });
};

export const changePassword = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '비밀번호 변경 (미구현)', data: null });
};

export const requestEmailChange = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '이메일 변경 인증 링크 발송 (미구현)', data: null });
};

export const confirmEmailChange = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '이메일 변경 확정 (미구현)', data: null });
};
