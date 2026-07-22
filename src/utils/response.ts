import { Response } from 'express';

export const sendSuccess = (res: Response, data: unknown, message = '요청 성공', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export interface PageMeta {
  offset: number;
  limit: number;
  total: number;
}

// 목록 응답 전용 — data와 같은 레벨에 page를 붙인다 (API 설계 규칙)
export const sendPaginated = (
  res: Response,
  data: unknown,
  page: PageMeta,
  message = '요청 성공',
  status = 200,
) => {
  return res.status(status).json({ success: true, message, data, page });
};

export const sendError = (
  res: Response,
  message: string,
  code: string,
  status = 400,
) => {
  return res.status(status).json({ success: false, message, error: { code } });
};
