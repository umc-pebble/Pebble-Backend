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
  inviteUserIds: z
    .array(z.number().int().positive())
    .max(50, '한 번에 최대 50명까지 초대할 수 있습니다.')
    .nullable()
    .optional(),
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

// 쿼리스트링 불리언. z.coerce.boolean()은 비어 있지 않은 문자열을 전부 true로 만들어
// "false"까지 true가 되므로 쓸 수 없다. 문자열 값을 직접 좁힌 뒤 변환한다.
const queryBoolean = (field: string) =>
  z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: `${field}는 true 또는 false여야 합니다.` }),
    })
    .transform((value) => value === 'true');

// 카테고리 목록 조회 필터. 둘 다 생략하면 기존 동작(소유 + 수락한 공유 카테고리 전부)이다.
export const listCategoriesQuerySchema = z.object({
  owned: queryBoolean('owned').optional(),
  isCompleted: queryBoolean('isCompleted').optional(),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesBody = z.infer<typeof reorderCategoriesSchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;