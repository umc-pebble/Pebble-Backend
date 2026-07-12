// Milestone Service
// 비즈니스 로직 계층. 소유권(2-hop: milestone→category→userId)·날짜 규칙을 담당한다.
// 현재는 SINGLE/RANGE만 지원한다. MULTI(dates→회차, seriesId, editScope/deleteScope)는
// 스키마 확정(REPEAT→MULTI, repeatDays 삭제) 및 Task enum 조율 후 추가한다.

import { AppError } from '../utils/app-error';
import { milestoneRepository } from './milestone.repository';
import { categoryService } from '../category/category.service';

interface CreateMilestoneInput {
  name: string;
  dateType: 'SINGLE' | 'RANGE';
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
}

interface UpdateMilestoneInput {
  name?: string;
  startDate?: string;
  endDate?: string | null;
  isCompleted?: boolean;
}

// 마일스톤 단건 소유권 검증(2-hop). 없으면 404, 상위 카테고리가 남의 것이면 403.
async function getOwnedMilestoneOrThrow(userId: number, milestoneId: number) {
  const milestone = await milestoneRepository.findByIdWithCategory(milestoneId);
  if (!milestone) {
    throw new AppError('COMMON_NOT_FOUND', '마일스톤을 찾을 수 없습니다.');
  }
  if (milestone.category.userId !== userId) {
    throw new AppError('COMMON_FORBIDDEN', '해당 마일스톤에 접근할 권한이 없습니다.');
  }
  return milestone;
}

export const milestoneService = {
  // 카테고리 하위 마일스톤 목록. 상위 카테고리 소유 검증(categoryService 재사용)이 선행된다.
  async getMilestones(userId: number, categoryId: number) {
    await categoryService.getCategory(userId, categoryId); // 404/403 판정 재사용
    return milestoneRepository.findManyByCategoryId(categoryId);
  },

  // 생성(SINGLE/RANGE). 날짜 조합 검증은 controller(zod)에서 1차 처리된 값을 받는다.
  async createMilestone(
    userId: number,
    categoryId: number,
    input: CreateMilestoneInput,
  ) {
    await categoryService.getCategory(userId, categoryId);

    const count = await milestoneRepository.countByCategoryId(categoryId);
    const milestone = await milestoneRepository.create({
      categoryId,
      name: input.name,
      dateType: input.dateType,
      startDate: new Date(input.startDate),
      // endDate는 RANGE 전용. SINGLE에서는 null.
      endDate:
        input.dateType === 'RANGE' && input.endDate
          ? new Date(input.endDate)
          : null,
      seriesId: null, // MULTI 전용. SINGLE/RANGE는 항상 null
      repeatDays: null, // 삭제 예정 컬럼. 현재는 항상 null
      displayOrder: count, // 목록 맨 뒤에 추가
    });

    // 응답은 배열로 반환한다(MULTI 확장 시 회차 여러 개가 되므로 형태 통일). SINGLE/RANGE는 1건.
    return { milestones: [milestone] };
  },

  // 수정(SINGLE/RANGE). 이름·날짜·완료 토글. editScope는 상위(controller)에서 이미 거른다.
  async updateMilestone(
    userId: number,
    milestoneId: number,
    input: UpdateMilestoneInput,
  ) {
    const existing = await getOwnedMilestoneOrThrow(userId, milestoneId);

    // dateType-endDate 정합성: endDate는 RANGE 전용. 생성 시 zod가 막는 규칙을
    // 수정에서도 유지한다(기존 row의 dateType은 DB 조회 후에만 알 수 있어 여기서 검사).
    if (existing.dateType !== 'RANGE' && input.endDate) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        'RANGE 마일스톤이 아니면 endDate를 지정할 수 없습니다.',
      );
    }
    if (existing.dateType === 'RANGE' && input.endDate === null) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        'RANGE 마일스톤의 endDate는 비울 수 없습니다.',
      );
    }

    // 날짜 정합성: 최종 startDate/endDate 기준 endDate < startDate면 400.
    const effectiveStart = input.startDate
      ? new Date(input.startDate)
      : existing.startDate;
    const effectiveEnd =
      input.endDate !== undefined
        ? input.endDate
          ? new Date(input.endDate)
          : null
        : existing.endDate;
    if (effectiveEnd && effectiveStart && effectiveEnd < effectiveStart) {
      throw new AppError('COMMON_INVALID_INPUT', '종료일은 시작일 이후여야 합니다.');
    }

    return milestoneRepository.update(milestoneId, {
      name: input.name,
      isCompleted: input.isCompleted,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate:
        input.endDate !== undefined
          ? input.endDate
            ? new Date(input.endDate)
            : null
          : undefined,
    });
  },

  // 삭제(하위 task는 CASCADE). deleteScope는 상위(controller)에서 이미 거른다.
  async deleteMilestone(userId: number, milestoneId: number) {
    await getOwnedMilestoneOrThrow(userId, milestoneId);
    await milestoneRepository.delete(milestoneId);
  },

  // 순서 변경. orderedIds가 모두 해당 카테고리 소속이고 중복이 없어야 한다(아니면 400).
  async reorderMilestones(
    userId: number,
    categoryId: number,
    orderedIds: number[],
  ) {
    await categoryService.getCategory(userId, categoryId);

    const all = await milestoneRepository.findManyByCategoryId(categoryId);
    const idsInCategory = new Set(all.map((m) => m.id));

    const hasDuplicate = new Set(orderedIds).size !== orderedIds.length;
    const allInCategory = orderedIds.every((id) => idsInCategory.has(id));
    if (hasDuplicate || !allInCategory) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '다른 카테고리의 마일스톤이 포함되어 있거나 잘못된 ID입니다.',
      );
    }

    await milestoneRepository.reorder(orderedIds);
  },
};