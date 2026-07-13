import { z } from 'zod';

// Category 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 컨트롤러/서비스는 여기서 파싱된 타입(z.infer)을 그대로 신뢰한다.

// 공백만으로 이루어진 이름은 불가하되, 이름 중간/양끝의 공백은 보존한다(trim 저장하지 않음).
const nameField = z
  .string()
  .max(100)
  .refine((s) => s.trim().length > 0, '카테고리 이름은 공백만으로 지정할 수 없습니다.');

export const createCategorySchema = z.object({
  name: nameField,
  color: z.string().min(1, '색상은 필수입니다.').max(20),
  imageUrl: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  inviteUserIds: z.array(z.number().int().positive()).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: nameField.optional(),
  color: z.string().min(1).max(20).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  isCompleted: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const reorderCategoriesSchema = z.object({
  orderedIds: z
    .array(z.number().int().positive())
    .min(1, 'orderedIds는 비어 있을 수 없습니다.'),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesBody = z.infer<typeof reorderCategoriesSchema>;