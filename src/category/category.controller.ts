import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Category Controller
// req/res 처리만 담당한다. 실제 로직은 추후 categoryService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getCategories = (_req: Request, res: Response) => {
  sendSuccess(res, { categories: [] }, '카테고리 목록 조회 (미구현)');
};

export const getCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '카테고리 단건 조회 (미구현)');
};

export const createCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '카테고리 생성 (미구현)', 201);
};

export const updateCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '카테고리 수정 (미구현)');
};

export const deleteCategory = (_req: Request, res: Response) => {
  sendSuccess(res, null, '카테고리 삭제 (미구현)');
};

export const reorderCategories = (_req: Request, res: Response) => {
  sendSuccess(res, null, '카테고리 순서 변경 (미구현)');
};