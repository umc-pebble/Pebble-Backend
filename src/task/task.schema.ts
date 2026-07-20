import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, '달력에 존재하지 않는 날짜입니다.');

const nameField = z
  .string()
  .refine(
    (value) => value.trim().length > 0,
    '태스크 이름은 공백만으로 지정할 수 없습니다.',
  );

export const createTaskSchema = z
  .object({
    categoryId: z.number().int().positive().nullable().optional(),
    milestoneId: z.number().int().positive().nullable().optional(),

    name: nameField,
    dateType: z.enum(['SINGLE', 'RANGE', 'MULTIPLE']),

    startDate: dateString.nullable().optional(),
    endDate: dateString.nullable().optional(),

    color: z.string().nullable().optional(),

    dates: z.array(dateString).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateType === 'SINGLE') {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'SINGLE에는 startDate가 필요합니다.',
        });
      }

      if (value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'SINGLE에는 endDate를 지정할 수 없습니다.',
        });
      }

      if (value.dates?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates'],
          message: 'SINGLE에는 dates를 지정할 수 없습니다.',
        });
      }
    }

    if (value.dateType === 'RANGE') {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'RANGE에는 startDate가 필요합니다.',
        });
      }

      if (!value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'RANGE에는 endDate가 필요합니다.',
        });
      }

      if (
        value.startDate &&
        value.endDate &&
        value.endDate < value.startDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: '종료일은 시작일 이후여야 합니다.',
        });
      }

      if (value.dates?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates'],
          message: 'RANGE에는 dates를 지정할 수 없습니다.',
        });
      }
    }

    if (value.dateType === 'MULTIPLE') {
      if (!value.dates || value.dates.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates'],
          message: 'MULTIPLE에는 하나 이상의 dates가 필요합니다.',
        });
      }

      if (value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'MULTIPLE에는 startDate를 지정할 수 없습니다.',
        });
      }

      if (value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'MULTIPLE에는 endDate를 지정할 수 없습니다.',
        });
      }

      if (
        value.dates &&
        new Set(value.dates).size !== value.dates.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates'],
          message: 'dates에는 중복된 날짜를 지정할 수 없습니다.',
        });
      }
    }
  });

export const deleteTaskQuerySchema = z
  .object({
    deleteScope: z.enum(['THIS_ONLY', 'ALL']).optional(),
    taskDateId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deleteScope === 'THIS_ONLY' && value.taskDateId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskDateId'],
        message: '이 항목만 삭제하려면 taskDateId가 필요합니다.',
      });
    }

    if (value.deleteScope === 'ALL' && value.taskDateId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskDateId'],
        message: '전체 삭제에는 taskDateId를 지정할 수 없습니다.',
      });
    }
  });
  
export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type DeleteTaskQuery = z.infer<typeof deleteTaskQuerySchema>;