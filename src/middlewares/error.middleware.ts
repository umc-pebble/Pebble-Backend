import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { ERROR_CODE } from '../constants/error-code';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.status,
      message: err.message,
      data: null,
    });
  }

  console.error(err.stack);
  res.status(ERROR_CODE.COMMON_INTERNAL_ERROR.status).json({
    code: ERROR_CODE.COMMON_INTERNAL_ERROR.status,
    message: '서버 오류가 발생했습니다.',
    data: null,
  });
};
