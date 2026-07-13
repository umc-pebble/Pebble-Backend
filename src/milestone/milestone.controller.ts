import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { AuthRequest } from '../middlewares/auth.middleware';
import { milestoneService } from './milestone.service';
import {
  CreateMilestoneBody,
  UpdateMilestoneBody,
  ReorderMilestonesBody,
} from './milestone.schema';

// Milestone Controller
// req/res 처리만 담당한다: JWT userId 추출 → service 호출 → sendSuccess 응답.
// body 검증은 라우트의 validateBody(milestone.schema) 미들웨어가 이미 마친 상태다.
// editScope/deleteScope의 허용 여부(도메인 규칙)는 milestoneService가 판정한다.

// 경로 파라미터를 양의 정수로 검증한다. (body가 아니므로 컨트롤러에서 처리)
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
    const dto = req.body as CreateMilestoneBody;
    const data = await milestoneService.createMilestone(req.userId!, categoryId, dto);
    sendSuccess(res, data, '마일스톤 생성 성공', 201);
  } catch (err) {
    next(err);
  }
};

export const updateMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, '마일스톤');
    const dto = req.body as UpdateMilestoneBody;
    const milestone = await milestoneService.updateMilestone(req.userId!, milestoneId, dto);
    sendSuccess(res, milestone, '마일스톤 수정 성공');
  } catch (err) {
    next(err);
  }
};

export const deleteMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, '마일스톤');
    // deleteScope는 쿼리파라미터. 허용 여부 판정은 service의 도메인 규칙이므로 그대로 전달한다.
    const deleteScope = req.query.deleteScope;
    await milestoneService.deleteMilestone(
      req.userId!,
      milestoneId,
      typeof deleteScope === 'string' ? deleteScope : undefined,
    );
    sendSuccess(res, {}, '마일스톤 삭제 성공');
  } catch (err) {
    next(err);
  }
};

export const reorderMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseId(req.params.categoryId, '카테고리');
    const { orderedIds } = req.body as ReorderMilestonesBody;
    await milestoneService.reorderMilestones(req.userId!, categoryId, orderedIds);
    sendSuccess(res, {}, '마일스톤 순서 변경 성공');
  } catch (err) {
    next(err);
  }
};