import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_CODE } from '../constants/error-code';

export interface AuthRequest extends Request {
  userId?: number;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(ERROR_CODE.COMMON_UNAUTHORIZED.status).json({
      code: ERROR_CODE.COMMON_UNAUTHORIZED.status,
      message: '인증 토큰이 없습니다.',
      data: null,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(ERROR_CODE.AUTH_TOKEN_EXPIRED.status).json({
      code: ERROR_CODE.AUTH_TOKEN_EXPIRED.status,
      message: '유효하지 않거나 만료된 토큰입니다.',
      data: null,
    });
  }
};
