import { Request, Response } from 'express';

// Upload Controller
// req/res 처리만 담당한다. 실제 업로드 로직은 추후 uploadService(Supabase Storage)로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const uploadImage = (_req: Request, res: Response) => {
  res.status(201).json({ code: 201, message: '이미지 업로드 (미구현)', data: null });
};
