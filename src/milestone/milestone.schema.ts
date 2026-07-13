import { z } from 'zod';

// Milestone 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 현재는 SINGLE/RANGE만 지원 — MULTI(dates 배열)는 스키마 확정 후 이 파일에 추가한다.

// YYYY-MM-DD 형식 + 달력에 실제 존재하는 날짜인지 검증.
// new Date('2026-02-31')은 에러가 아니라 3월 3일로 "보정"되므로(V8 롤오버),
// 연·월·일을 분해해 Date로 재조립한 값이 입력과 일치하는지 비교해 보정 발생을 잡아낸다.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    );
  }, '달력에 존재하지 않는 날짜입니다.');

const nameField = z
  .string()
  .max(100)
  .refine((s) => s.trim().length > 0, '이름은 공백만으로 지정할 수 없습니다.');

export const createMilestoneSchema = z
  .object({
    name: nameField,
    // MULTI는 아직 미지원 → SINGLE/RANGE만 허용.
    dateType: z.enum(['SINGLE', 'RANGE'], {
      errorMap: () => ({ message: '현재 SINGLE, RANGE만 지원합니다. (MULTI는 준비 중)' }),
    }),
    startDate: dateString,
    endDate: dateString.nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.dateType === 'SINGLE' && val.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SINGLE에는 endDate를 지정할 수 없습니다.' });
    }
    if (val.dateType === 'RANGE') {
      if (!val.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RANGE에는 endDate가 필요합니다.' });
      } else if (val.endDate < val.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '종료일은 시작일 이후여야 합니다.' });
      }
    }
  });

export const updateMilestoneSchema = z.object({
  name: nameField.optional(),
  startDate: dateString.optional(),
  endDate: dateString.nullable().optional(),
  isCompleted: z.boolean().optional(),
  // 값 형태만 여기서 검사한다. "MULTI가 아니면 지정 불가" 판정은 service의 도메인 규칙.
  editScope: z.enum(['THIS_ONLY', 'ALL']).optional(),
});

export const reorderMilestonesSchema = z.object({
  orderedIds: z
    .array(z.number().int().positive())
    .min(1, 'orderedIds는 비어 있을 수 없습니다.'),
});

export type CreateMilestoneBody = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneBody = z.infer<typeof updateMilestoneSchema>;
export type ReorderMilestonesBody = z.infer<typeof reorderMilestonesSchema>;