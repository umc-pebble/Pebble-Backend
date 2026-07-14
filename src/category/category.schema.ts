import { z } from 'zod';

// Category 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 컨트롤러/서비스는 여기서 파싱된 타입(z.infer)을 그대로 신뢰한다.

// 공백만으로 이루어진 이름은 불가하되, 이름 중간/양끝의 공백은 보존한다(trim 저장하지 않음).
const nameField = z
  .string()
  .max(100)
  .refine((s) => s.trim().length > 0, '카테고리 이름은 공백만으로 지정할 수 없습니다.');

// Swagger 계약("HEX 색상 코드")과 일치하도록 #RGB / #RRGGBB 형식만 허용한다.
const colorField = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, '색상은 hex 코드 형식이어야 합니다.');

export const createCategorySchema = z.object({
  name: nameField,
  color: colorField,
  imageUrl: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  inviteUserIds: z.array(z.number().int().positive()).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: nameField.optional(),
  color: colorField.optional(),
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