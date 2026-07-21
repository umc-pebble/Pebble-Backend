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
  .max(100, '태스크 이름은 100자 이하여야 합니다.')
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
  
export const updateTaskSchema = z
  .object({
    name: nameField.optional(),

    startDate: dateString.nullable().optional(),
    endDate: dateString.nullable().optional(),

    color: z.string().nullable().optional(),

    dates: z.array(dateString).nullable().optional(),

    editScope: z.enum(['THIS_ONLY', 'ALL']).optional(),
    taskDateId: z.number().int().positive().optional(),

    // 생성 이후 변경할 수 없는 필드
    dateType: z.any().optional(),
    categoryId: z.any().optional(),
    milestoneId: z.any().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateType !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateType'],
        message: 'dateType은 수정할 수 없습니다.',
      });
    }

    if (value.categoryId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: '태스크의 소속 카테고리는 수정할 수 없습니다.',
      });
    }

    if (value.milestoneId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['milestoneId'],
        message: '태스크의 소속 마일스톤은 수정할 수 없습니다.',
      });
    }

    const hasEditableField =
      value.name !== undefined ||
      value.startDate !== undefined ||
      value.endDate !== undefined ||
      value.color !== undefined ||
      value.dates !== undefined;

    if (!hasEditableField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: '수정할 값을 하나 이상 입력해야 합니다.',
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

    if (
      value.dates !== undefined &&
      (
        value.name !== undefined ||
        value.startDate !== undefined ||
        value.endDate !== undefined ||
        value.color !== undefined ||
        value.editScope !== undefined ||
        value.taskDateId !== undefined
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dates'],
        message: '다중 날짜 수정은 다른 수정 필드와 함께 요청할 수 없습니다.',
      });
    }

    if (
      (value.name !== undefined || value.color !== undefined) &&
      value.editScope === undefined
    ) {
      return;
    }

    if (
      value.editScope !== undefined &&
      value.name === undefined &&
      value.color === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['editScope'],
        message: 'editScope는 이름 또는 색상 수정 시에만 사용할 수 있습니다.',
      });
    }

    if (
      value.editScope === 'THIS_ONLY' &&
      value.taskDateId == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskDateId'],
        message: '이 항목만 수정하려면 taskDateId가 필요합니다.',
      });
    }

    if (
      value.editScope === 'ALL' &&
      value.taskDateId !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskDateId'],
        message: '전체 수정에는 taskDateId를 지정할 수 없습니다.',
      });
    }

    if (
      value.taskDateId !== undefined &&
      value.editScope !== 'THIS_ONLY'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskDateId'],
        message: 'taskDateId는 THIS_ONLY 수정에서만 사용할 수 있습니다.',
      });
    }
  });

export const reorderTasksSchema = z.object({
  milestoneId: z
    .number()
    .int('milestoneId는 정수여야 합니다.')
    .positive('milestoneId는 양의 정수여야 합니다.'),

  orderedIds: z
    .array(
      z
        .number()
        .int('orderedIds의 값은 정수여야 합니다.')
        .positive('orderedIds의 값은 양의 정수여야 합니다.'),
    )
    .min(1, 'orderedIds에는 하나 이상의 taskId가 필요합니다.')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'orderedIds에는 중복된 taskId를 지정할 수 없습니다.',
    ),
});

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type ReorderTasksBody = z.infer<typeof reorderTasksSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;