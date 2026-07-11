import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { categoryService } from './category.service';

// Category Controller
// req/res 처리만 담당한다: JWT에서 userId 추출 → 입력 검증(zod) → categoryService 호출 → sendSuccess 응답.
// 도메인 규칙은 categoryService가, 에러 포맷 통일은 error.middleware가 담당한다.

// ── 입력 스키마(zod) ─────────────────────────────
// 공백만으로 이루어진 이름은 불가하되, 이름 중간/양끝의 공백은 보존한다(trim 저장하지 않음).
const nameField = z
  .string()
  .max(100)
  .refine((s) => s.trim().length > 0, '카테고리 이름은 공백만으로 지정할 수 없습니다.');

const createCategorySchema = z.object({
  name: nameField,
  color: z.string().min(1, '색상은 필수입니다.').max(20),
  imageUrl: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  inviteUserIds: z.array(z.number().int().positive()).nullable().optional(),
});

const updateCategorySchema = z.object({
  name: nameField.optional(),
  color: z.string().min(1).max(20).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  isCompleted: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1, 'orderedIds는 비어 있을 수 없습니다.'),
});

// zod 검증 실패를 공통 400 에러(AppError)로 변환한다.
function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('COMMON_INVALID_INPUT', result.error.issues[0].message);
  }
  return result.data;
}

// 경로 파라미터(categoryId)를 양의 정수로 검증한다.
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
    const dto = parseOrThrow(createCategorySchema, req.body);
    const data = await categoryService.createCategory(req.userId!, dto);
    sendSuccess(res, data, '카테고리 생성 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseCategoryId(req.params.categoryId);
    const dto = parseOrThrow(updateCategorySchema, req.body);
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
    const { orderedIds } = parseOrThrow(reorderSchema, req.body);
    await categoryService.reorderCategories(req.userId!, orderedIds);
    sendSuccess(res, {}, '카테고리 순서 변경 성공');
  } catch (err) {
    next(err);
  }
};