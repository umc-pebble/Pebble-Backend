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

const datesField = z
  .array(dateString)
  .max(100, '날짜는 한 번에 100개까지 지정할 수 있습니다.')
  .nullable();

const dateTypeField = z.enum(['SINGLE', 'RANGE', 'MULTIPLE']);

// 날짜 필드는 dateType별로 조합이 다르다:
//   SINGLE   → startDate만
//   RANGE    → startDate + endDate
//   MULTIPLE → dates 배열만 (회차마다 row가 되므로 startDate/endDate 대신 사용)
// 생성과 "날짜 재지정" 수정(#84)이 같은 규칙을 쓰므로 함수로 분리해 공유한다.
function refineDateFields(
  val: {
    dateType: 'SINGLE' | 'RANGE' | 'MULTIPLE';
    startDate?: string;
    endDate?: string | null;
    dates?: string[] | null;
  },
  ctx: z.RefinementCtx,
) {
  if (val.dateType === 'MULTIPLE') {
    if (val.startDate !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'MULTIPLE에는 startDate 대신 dates를 사용합니다.' });
    }
    if (val.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'MULTIPLE에는 endDate를 지정할 수 없습니다.' });
    }
    if (!val.dates || val.dates.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'MULTIPLE에는 dates(날짜 배열)가 필요합니다.' });
    } else if (new Set(val.dates).size !== val.dates.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'dates에 중복된 날짜가 있습니다.' });
    }
    return;
  }

  // SINGLE/RANGE 공통
  if (!val.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'startDate가 필요합니다.' });
  }
  if (val.dates && val.dates.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'dates는 MULTIPLE에서만 사용합니다.' });
  }
  if (val.dateType === 'SINGLE' && val.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'SINGLE에는 endDate를 지정할 수 없습니다.' });
  }
  if (val.dateType === 'RANGE') {
    if (!val.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'RANGE에는 endDate가 필요합니다.' });
    } else if (val.startDate && val.endDate < val.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: '종료일은 시작일 이후여야 합니다.' });
    }
  }
}

export const createMilestoneSchema = z
  .object({
    name: nameField,
    dateType: dateTypeField,
    startDate: dateString.optional(),
    endDate: dateString.nullable().optional(),
    dates: datesField.optional(),
  })
  .superRefine(refineDateFields);

// 수정은 두 갈래다:
//   dateType 없음 → 기존 부분 수정. 날짜 타입은 그대로 두고 전달된 필드만 반영한다.
//   dateType 있음 → "날짜 타입 변경"(#84). 프론트 모달에서 하루/기간/다중 탭을 고른 경우로,
//                   같은 타입을 다시 골라도 날짜를 통째로 새로 지정하므로 생성과 같은 조합 규칙을 요구한다.
export const updateMilestoneSchema = z
  .object({
    name: nameField.optional(),
    dateType: dateTypeField.optional(),
    startDate: dateString.optional(),
    endDate: dateString.nullable().optional(),
    dates: datesField.optional(),
    isCompleted: z.boolean().optional(),
    // 값 형태만 여기서 검사한다. "MULTIPLE가 아니면 지정 불가" 판정은 service의 도메인 규칙.
    editScope: z.enum(['THIS_ONLY', 'ALL']).optional(),
    // 카테고리 이동은 미지원. 다만 수정 모달이 폼 전체(변경 없는 카테고리 포함)를 보내는 경우가
    // 있어 필드 자체는 받아둔다. 현재 카테고리와 같은 값인지 판정은 service가 한다
    // (기존 row를 조회해야 알 수 있고, 여기서 걸러내면 조용히 무시돼 원인 파악이 어렵다).
    categoryId: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    // 태스크 수정과 동일하게, 바꿀 값이 하나도 없는 요청은 거부한다.
    const hasEditableField =
      val.name !== undefined ||
      val.dateType !== undefined ||
      val.startDate !== undefined ||
      val.endDate !== undefined ||
      val.dates !== undefined ||
      val.isCompleted !== undefined;

    if (!hasEditableField) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: '수정할 값을 하나 이상 입력해야 합니다.' });
    }

    if (val.dateType === undefined) {
      if (val.dates !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'dates는 dateType과 함께 보내야 합니다.' });
      }
      return;
    }

    // 날짜 타입 변경은 날짜를 통째로 새로 지정하는 동작이라, 기존 날짜 구성을 전제로 하는
    // 필드와 함께 쓸 수 없다(editScope는 회차별 이름 전파 범위를 고르는 값).
    if (val.editScope !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['editScope'], message: 'dateType을 지정하면 날짜가 새로 설정되므로 editScope를 함께 보낼 수 없습니다.' });
    }
    // 날짜 타입 변경은 완료 상태를 그대로 보존한다. 함께 받으면 조용히 무시되므로 명시적으로 막는다.
    if (val.isCompleted !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['isCompleted'], message: 'dateType 변경과 완료 상태 수정은 함께 요청할 수 없습니다.' });
    }
    refineDateFields({ ...val, dateType: val.dateType }, ctx);
  });

export const reorderMilestonesSchema = z.object({
  orderedIds: z
    .array(z.number().int().positive())
    .min(1, 'orderedIds는 비어 있을 수 없습니다.'),
});

export type CreateMilestoneBody = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneBody = z.infer<typeof updateMilestoneSchema>;
export type ReorderMilestonesBody = z.infer<typeof reorderMilestonesSchema>;