import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/app-error';

// body 검증 미들웨어 (.coderabbit.yaml 라우트 규칙: "body 검증은 zod 스키마 + validateBody(schema) 미들웨어로").
// 검증 통과 시 req.body를 파싱된(변환·기본값 적용된) 값으로 교체하므로,
// 컨트롤러는 req.body를 스키마 타입 그대로 믿고 쓸 수 있다.
export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError('COMMON_INVALID_INPUT', result.error.issues[0].message));
    }
    req.body = result.data;
    next();
  };

// 쿼리스트링 검증 — body와 동일한 규칙. 쿼리는 항상 문자열로 들어오므로
// 스키마에서 z.coerce로 숫자·불리언 변환을 해두고, 여기서 변환된 값으로 교체한다.
export const validateQuery =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new AppError('COMMON_INVALID_INPUT', result.error.issues[0].message));
    }
    req.query = result.data;
    next();
  };