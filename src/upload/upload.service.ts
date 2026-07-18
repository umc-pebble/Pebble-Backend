// Upload Service
// 비즈니스 로직 계층. 파일을 Supabase Storage에 업로드하고 공개 URL을 반환한다.
// DB 테이블이 아닌 스토리지 대상이므로 repository 계층은 두지 않는다.

import { randomUUID } from 'crypto';
import supabase, { UPLOAD_BUCKET } from '../config/supabase';
import { AppError } from '../utils/app-error';
import { IMAGE_EXTENSION_BY_MIME } from '../middlewares/upload.middleware';

export const uploadService = {
  async uploadImage(file?: Express.Multer.File) {
    if (!file) {
      throw new AppError('COMMON_INVALID_INPUT', '업로드할 파일이 없습니다.');
    }
    // fileFilter(upload.middleware.ts)에서 이미 검증된 mimetype만 들어오므로,
    // 클라이언트가 보낸 원본 파일명 대신 mimetype 기준으로 확장자를 고정한다.
    const extension = IMAGE_EXTENSION_BY_MIME[file.mimetype];
    // 파일명 중복으로 인한 덮어쓰기를 막기 위해 UUID로 고유 파일명을 생성한다.
    const fileName = `${randomUUID()}.${extension}`;

    let error: { message: string } | null;
    try {
      ({ error } = await supabase.storage.from(UPLOAD_BUCKET).upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      }));
    } catch (err) {
      console.error(err);
      throw new AppError('COMMON_INTERNAL_ERROR', '이미지 업로드에 실패했습니다.');
    }

    if (error) {
      throw new AppError('COMMON_INTERNAL_ERROR', '이미지 업로드에 실패했습니다.');
    }

    const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(fileName);
    return { imageUrl: data.publicUrl };
  },
};
