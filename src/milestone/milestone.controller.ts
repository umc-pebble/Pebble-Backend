import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { milestoneService } from './milestone.service';

// Milestone Controller
// JWT userId 추출 → 입력 검증(zod) → milestoneService 호출 → sendSuccess.
// 현재는 SINGLE/RANGE만 지원한다. MULTI 및 editScope/deleteScope 지정은 400으로 거부한다.

// YYYY-MM-DD 형식 + 실제 유효한 날짜인지 검증.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), '유효한 날짜가 아닙니다.');

const nameField = z
  .string()
  .max(100)
  .refine((s) => s.trim().length > 0, '이름은 공백만으로 지정할 수 없습니다.');

const createMilestoneSchema = z
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

const updateMilestoneSchema = z.object({
  name: nameField.optional(),
  startDate: dateString.optional(),
  endDate: dateString.nullable().optional(),
  isCompleted: z.boolean().optional(),
  // editScope는 MULTI 전용. 값이 오면 아래에서 400으로 거부한다.
  editScope: z.enum(['THIS_ONLY', 'ALL']).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1, 'orderedIds는 비어 있을 수 없습니다.'),
});

function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('COMMON_INVALID_INPUT', result.error.issues[0].message);
  }
  return result.data;
}

function parseId(raw: string, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', `유효하지 않은 ${label} ID입니다.`);
  }
  return id;
}

export const getMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const milestones = await milestoneService.getMilestones(req.userId!, categoryId);
    sendSuccess(res, { milestones }, '마일스톤 목록 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const createMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const dto = parseOrThrow(createMilestoneSchema, req.body);
    const data = await milestoneService.createMilestone(req.userId!, categoryId, dto);
    sendSuccess(res, data, '마일스톤 생성 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const updateMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, '마일스톤');
    const dto = parseOrThrow(updateMilestoneSchema, req.body);
    // SINGLE/RANGE만 존재하므로 editScope는 항상 부적절 → 400 (MULTI 구현 시 완화).
    if (dto.editScope !== undefined) {
      throw new AppError('COMMON_INVALID_INPUT', '다중 마일스톤이 아니면 editScope를 지정할 수 없습니다.');
    }
    const milestone = await milestoneService.updateMilestone(req.userId!, milestoneId, dto);
    sendSuccess(res, milestone, '마일스톤 수정 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, '마일스톤');
    // deleteScope는 MULTI 전용 쿼리파라미터. SINGLE/RANGE만 존재하므로 지정 시 400.
    if (req.query.deleteScope !== undefined) {
      throw new AppError('COMMON_INVALID_INPUT', '다중 마일스톤이 아니면 deleteScope를 지정할 수 없습니다.');
    }
    await milestoneService.deleteMilestone(req.userId!, milestoneId);
    sendSuccess(res, {}, '마일스톤 삭제 성공');
  } catch (err) {
    next(err);
  }
};

export const reorderMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const { orderedIds } = parseOrThrow(reorderSchema, req.body);
    await milestoneService.reorderMilestones(req.userId!, categoryId, orderedIds);
    sendSuccess(res, {}, '마일스톤 순서 변경 성공');
  } catch (err) {
    next(err);
  }
};