import { Response } from 'express';

export const sendSuccess = (res: Response, data: unknown, message = '요청 성공', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export const sendError = (
  res: Response,
  message: string,
  code: string,
  status = 400,
) => {
  return res.status(status).json({ success: false, message, error: { code } });
};
