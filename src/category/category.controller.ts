import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { categoryService } from './category.service';
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  ReorderCategoriesBody,
} from './category.schema';

// Category Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.
// body 검증은 라우트의 validateBody(category.schema) 미들웨어가 이미 마친 상태다.
// 도메인 규칙·에러 throw는 categoryService, 에러 포맷 통일은 error.middleware 담당.

// 경로 파라미터(categoryId)를 양의 정수로 검증한다. (body가 아니므로 컨트롤러에서 처리)
function parseCategoryId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', '유효하지 않은 카테고리 ID입니다.');
  }
  return id;
}

export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.getCategories(req.userId!);
    sendSuccess(res, { categories }, '카테고리 목록 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseCategoryId(req.params.categoryId);
    const category = await categoryService.getCategory(req.userId!, categoryId);
    sendSuccess(res, category, '카테고리 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dto = req.body as CreateCategoryBody;
    const data = await categoryService.createCategory(req.userId!, dto);
    sendSuccess(res, data, '카테고리 생성 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseCategoryId(req.params.categoryId);
    const dto = req.body as UpdateCategoryBody;
    const category = await categoryService.updateCategory(req.userId!, categoryId, dto);
    sendSuccess(res, category, '카테고리 수정 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseCategoryId(req.params.categoryId);
    await categoryService.deleteCategory(req.userId!, categoryId);
    sendSuccess(res, {}, '카테고리 삭제 성공');
  } catch (err) {
    next(err);
  }
};

export const reorderCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderedIds } = req.body as ReorderCategoriesBody;
    await categoryService.reorderCategories(req.userId!, orderedIds);
    sendSuccess(res, {}, '카테고리 순서 변경 성공');
  } catch (err) {
    next(err);
  }
};