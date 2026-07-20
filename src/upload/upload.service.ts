// Upload Service
// 비즈니스 로직 계층. 파일을 Supabase Storage에 업로드하고 공개 URL을 반환한다.
// DB 테이블이 아닌 스토리지 대상이므로 repository 계층은 두지 않는다.

import { randomUUID } from 'crypto';
import supabase, { UPLOAD_BUCKET } from '../config/supabase';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { IMAGE_EXTENSION_BY_MIME } from '../middlewares/upload.middleware';

// getPublicUrl이 반환하는 형식과 동일하다: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`.
// 이 prefix로 시작하지 않는 URL은 우리 버킷 소유가 아니므로(예: PLB-004 기본 이미지 등) 삭제 대상에서 제외한다.
const PUBLIC_URL_PREFIX = `${process.env.SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/`;

export const uploadService = {
  async uploadImage(file: Express.Multer.File) {
    // fileFilter(upload.middleware.ts)에서 이미 검증된 mimetype만 들어오므로,
    // 클라이언트가 보낸 원본 파일명 대신 mimetype 기준으로 확장자를 고정한다.
    const extension = IMAGE_EXTENSION_BY_MIME[file.mimetype];
    // 파일명 중복으로 인한 덮어쓰기를 막기 위해 UUID로 고유 파일명을 생성한다.
    const fileName = `${randomUUID()}.${extension}`;

    try {
      const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
      if (error) {
        logger.error(error);
        throw new AppError('COMMON_INTERNAL_ERROR', '이미지 업로드에 실패했습니다.');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error(err);
      throw new AppError('COMMON_INTERNAL_ERROR', '이미지 업로드에 실패했습니다.');
    }

    const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(fileName);
    return { imageUrl: data.publicUrl };
  },

  // 프로필 이미지 등이 교체/제거될 때 이전 파일을 정리한다. 호출부(user.service.ts 등)의
  // 응답 자체를 실패시키지 않도록 베스트 에포트로 동작하며, 실패해도 에러를 던지지 않고 로그만 남긴다.
  async deleteImage(imageUrl: string | null | undefined) {
    if (!imageUrl || !imageUrl.startsWith(PUBLIC_URL_PREFIX)) return;
    const path = imageUrl.slice(PUBLIC_URL_PREFIX.length);

    try {
      const { error } = await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
      if (error) {
        logger.error(error);
      }
    } catch (err) {
      logger.error(err);
    }
  },
};
