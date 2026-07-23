import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error';

// 이미지 업로드 전용 multer 설정.
// Supabase Storage로 바로 올릴 것이므로 디스크에 쓰지 않고 메모리 버퍼로만 받는다.
// mimetype→확장자 매핑이 곧 허용 mimetype 목록의 단일 출처다 (upload.service.ts도 이 맵을 가져다 쓴다).
export const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ALLOWED_MIME_TYPES = Object.keys(IMAGE_EXTENSION_BY_MIME);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// mimetype은 클라이언트가 임의로 지정할 수 있으므로, 실제 저장 전 파일 시그니처(매직 바이트)로
// 한 번 더 검증한다. mimetype이 스푸핑돼도 여기서 걸러진다.
const FILE_SIGNATURE_MATCHERS: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': (buffer) =>
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP',
};

interface UploadRequest extends Request {
  fileTypeRejected?: boolean;
}

const multerUpload = multer({
  storage: multer.memoryStorage(),
  // 이 엔드포인트는 파일 1개만 받으므로 텍스트 필드는 허용하지 않는다(fields: 0).
  // parts 제한은 별도로 두지 않는다 — busboy가 정상적인 단일 파일 요청도 part 수를 초과로 잘못 세어
  // LIMIT_PART_COUNT로 거부하는 문제가 있었고, fields: 0 + .single('file')만으로도
  // "파일 1개 외 다른 값 금지"라는 목적은 이미 충족된다.
  limits: { fileSize: MAX_FILE_SIZE, fields: 0 },
  fileFilter: (req: UploadRequest, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // cb(error)로 즉시 거부하면 busboy가 남은 요청 스트림을 비우지 않고 파싱을 중단한다.
      // 파일이 클 경우 클라이언트가 업로드를 끝내기 전에 서버가 응답·커넥션을 정리해버려
      // 브라우저에서 정상 응답 대신 네트워크 에러(Failed to fetch)로 보일 수 있다.
      // cb(null, false)로 파일 저장만 건너뛰고 스트림은 끝까지 소비(drain)한 뒤 에러로 변환한다.
      req.fileTypeRejected = true;
      cb(null, false);
      return;
    }
    cb(null, true);
  },
}).single('file');

// multer는 용량 초과 시 콜백으로 MulterError(LIMIT_FILE_SIZE)를 넘기므로,
// 공통 에러 포맷(AppError)으로 변환해 error.middleware가 동일하게 처리하도록 한다.
export const uploadSingleImage = (req: UploadRequest, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('FILE_SIZE_EXCEEDED', '업로드 가능한 최대 용량(5MB)을 초과했습니다.'));
      }
      // 필드명 불일치(LIMIT_UNEXPECTED_FILE) 등 그 외 Multer 에러는 모두 클라이언트 요청 문제다.
      return next(new AppError('COMMON_INVALID_INPUT', '파일 업로드 요청이 올바르지 않습니다.'));
    }
    if (err) return next(err);
    if (req.fileTypeRejected) {
      return next(new AppError('FILE_TYPE_NOT_ALLOWED', 'JPEG/PNG/WEBP 형식만 업로드할 수 있습니다.'));
    }
    if (req.file && !FILE_SIGNATURE_MATCHERS[req.file.mimetype]?.(req.file.buffer)) {
      return next(new AppError('FILE_TYPE_NOT_ALLOWED', 'JPEG/PNG/WEBP 형식만 업로드할 수 있습니다.'));
    }
    next();
  });
};
