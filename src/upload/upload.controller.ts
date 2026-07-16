import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';

// Upload Controller
// req/res 처리만 담당한다. 실제 업로드 로직은 추후 uploadService(Supabase Storage)로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.
// Express 4는 async 에러를 자동 전파하지 않으므로 try/catch + next(err) 시그니처를 유지한다.

export const uploadImage = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, null, '이미지 업로드 (미구현)', 200);
  } catch (err) {
    next(err);
  }
};
