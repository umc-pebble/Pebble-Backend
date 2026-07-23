import { z } from 'zod';

// Milestone 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).

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

// 날짜 필드는 dateType별로 조합이 다르다:
//   SINGLE   → startDate만
//   RANGE    → startDate + endDate
//   MULTIPLE → dates 배열만 (회차마다 row가 되므로 startDate/endDate 대신 사용)
export const createMilestoneSchema = z
  .object({
    name: nameField,
    dateType: z.enum(['SINGLE', 'RANGE', 'MULTIPLE']),
    startDate: dateString.optional(),
    endDate: dateString.nullable().optional(),
    dates: z
      .array(dateString)
      .max(100, '날짜는 한 번에 100개까지 지정할 수 있습니다.')
      .nullable()
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.dateType === 'MULTIPLE') {
      if (val.startDate !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MULTIPLE에는 startDate 대신 dates를 사용합니다.' });
      }
      if (val.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MULTIPLE에는 endDate를 지정할 수 없습니다.' });
      }
      if (!val.dates || val.dates.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MULTIPLE에는 dates(날짜 배열)가 필요합니다.' });
      } else if (new Set(val.dates).size !== val.dates.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dates에 중복된 날짜가 있습니다.' });
      }
      return;
    }

    // SINGLE/RANGE 공통
    if (!val.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startDate가 필요합니다.' });
    }
    if (val.dates && val.dates.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dates는 MULTIPLE에서만 사용합니다.' });
    }
    if (val.dateType === 'SINGLE' && val.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SINGLE에는 endDate를 지정할 수 없습니다.' });
    }
    if (val.dateType === 'RANGE') {
      if (!val.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RANGE에는 endDate가 필요합니다.' });
      } else if (val.startDate && val.endDate < val.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '종료일은 시작일 이후여야 합니다.' });
      }
    }
  });

export const updateMilestoneSchema = z.object({
  name: nameField.optional(),
  startDate: dateString.optional(),
  endDate: dateString.nullable().optional(),
  isCompleted: z.boolean().optional(),
  // 값 형태만 여기서 검사한다. "MULTIPLE가 아니면 지정 불가" 판정은 service의 도메인 규칙.
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