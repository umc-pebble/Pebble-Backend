import { Response } from 'express';

// 공통 응답 포맷: { code, message, data }. code는 HTTP 상태 코드(정수).
export const sendSuccess = (res: Response, data: unknown, message = '요청 성공', status = 200) => {
  return res.status(status).json({ code: status, message, data });
};

export const sendError = (res: Response, message: string, status = 400) => {
  return res.status(status).json({ code: status, message, data: null });
};
