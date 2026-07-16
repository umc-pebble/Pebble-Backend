import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { uploadService } from './upload.service';

// Upload Controller
// req/res 처리만 담당한다. 파일 검증(형식/용량)은 upload.middleware(multer)가 이미 마친 상태다.

export const uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('COMMON_INVALID_INPUT', '업로드할 파일이 없습니다.');
    }
    const data = await uploadService.uploadImage(req.file);
    sendSuccess(res, data, '이미지 업로드 성공', 200);
  } catch (err) {
    next(err);
  }
};
