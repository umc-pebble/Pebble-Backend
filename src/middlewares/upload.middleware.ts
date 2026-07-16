import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error';

// 이미지 업로드 전용 multer 설정.
// Supabase Storage로 바로 올릴 것이므로 디스크에 쓰지 않고 메모리 버퍼로만 받는다.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError('FILE_TYPE_NOT_ALLOWED', 'JPEG/PNG/WEBP 형식만 업로드할 수 있습니다.'));
      return;
    }
    cb(null, true);
  },
}).single('file');

// multer는 용량 초과 시 콜백으로 MulterError(LIMIT_FILE_SIZE)를 넘기므로,
// 공통 에러 포맷(AppError)으로 변환해 error.middleware가 동일하게 처리하도록 한다.
export const uploadSingleImage = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('FILE_SIZE_EXCEEDED', '업로드 가능한 최대 용량(5MB)을 초과했습니다.'));
    }
    if (err) return next(err);
    next();
  });
};
