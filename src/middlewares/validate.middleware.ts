import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/app-error';

// body 검증 공통 미들웨어 — 라우트에 validateBody(스키마)로 장착한다.
// 실패 시 스키마에 정의된 첫 번째 한국어 메시지와 함께 COMMON_INVALID_INPUT(400)으로 응답된다.
export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.';
      return next(new AppError('COMMON_INVALID_INPUT', message));
    }
    req.body = result.data;
    next();
  };
