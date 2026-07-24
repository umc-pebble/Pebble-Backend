// Milestone Service
// 비즈니스 로직 계층. 소유권(2-hop: milestone→category→userId)·날짜 규칙·scope 규칙을 담당한다.
// MULTIPLE(다중 날짜)는 선택한 날짜마다 실제 row(회차)로 저장되며 같은 seriesId를 공유한다.

import { AppError } from '../utils/app-error';
import { milestoneRepository } from './milestone.repository';
import { categoryService } from '../category/category.service';

interface CreateMilestoneInput {
  name: string;
  dateType: 'SINGLE' | 'RANGE' | 'MULTIPLE';
  startDate?: string; // YYYY-MM-DD (SINGLE/RANGE)
  endDate?: string | null; // RANGE 전용
  dates?: string[] | null; // MULTIPLE 전용
}

interface UpdateMilestoneInput {
  name?: string;
  startDate?: string;
  endDate?: string | null;
  isCompleted?: boolean;
  editScope?: 'THIS_ONLY' | 'ALL';
}

// "오늘"의 한국(KST) 날짜를 UTC 자정 Date로 만든다.
// DB의 @db.Date 값은 Prisma에서 UTC 자정 Date로 오가므로, 같은 기준으로 맞춰야
// 서버 타임존과 무관하게 "오늘 이후 회차" 비교(PLB-013·014)가 정확하다.
function kstToday(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
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

  // 친구 프로필 조회(#64): 친구(또는 본인)의 공개 카테고리 하위 마일스톤 목록.
  // 친구 접근 판정 + 공개 카테고리 검증은 categoryService에 위임한다(마일스톤은 카테고리로 소유·공개를 판정).
  // 비공개 카테고리는 categoryService가 404로 막으므로 여기서 별도 처리는 필요 없다.
  async getFriendMilestones(requesterId: number, targetUserId: number, categoryId: number) {
    await categoryService.getFriendPublicCategory(requesterId, targetUserId, categoryId);
    return milestoneRepository.findManyByCategoryId(categoryId);
  },

  // 생성. 날짜 조합 검증(dateType별 필수/금지 필드)은 controller(zod)에서 1차 처리된 값을 받는다.
  // displayOrder는 repository가 startDate 기준 위치로 채번한다(PLB-016 D-Day 오름차순).
  async createMilestone(
    userId: number,
    categoryId: number,
    input: CreateMilestoneInput,
  ) {
    await categoryService.getCategory(userId, categoryId);

    // MULTIPLE: dates의 날짜마다 회차 row 일괄 생성, 같은 seriesId 부여 (PLB-012)
    if (input.dateType === 'MULTIPLE') {
      const milestones = await milestoneRepository.createMultiple({
        categoryId,
        name: input.name,
        dates: (input.dates ?? []).map((d) => new Date(d)),
      });
      return { milestones };
    }

    const milestone = await milestoneRepository.create({
      categoryId,
      name: input.name,
      dateType: input.dateType,
      startDate: new Date(input.startDate!), // zod가 SINGLE/RANGE에서 필수 보장
      endDate:
        input.dateType === 'RANGE' && input.endDate
          ? new Date(input.endDate)
          : null,
      seriesId: null, // MULTIPLE 전용. SINGLE/RANGE는 항상 null
    });

    // 응답은 배열로 통일한다(MULTIPLE는 회차 여러 개). SINGLE/RANGE는 1건.
    return { milestones: [milestone] };
  },

  // 수정 (PLB-013).
  // - editScope는 "MULTIPLE의 이름 수정"에만 쓰인다(모달 필수 택1, 기본값 없음).
  //   날짜(startDate)·완료(isCompleted)는 scope 없이 항상 해당 회차 1건에만 적용된다
  //   (날짜 수정은 모달이 뜨지 않음, 완료는 회차별 독립 기록).
  // - editScope=ALL은 같은 seriesId 중 "오늘 이후 + 미완료" 회차에 이름을 전파한다
  //   (완료된 과거 회차는 보존).
  async updateMilestone(
    userId: number,
    milestoneId: number,
    input: UpdateMilestoneInput,
  ) {
    const existing = await getOwnedMilestoneOrThrow(userId, milestoneId);

    if (existing.dateType === 'MULTIPLE') {
      if (input.name !== undefined && input.editScope === undefined) {
        throw new AppError(
          'COMMON_INVALID_INPUT',
          '다중 마일스톤 이름 수정에는 editScope(THIS_ONLY 또는 ALL)를 지정해야 합니다.',
        );
      }
      if (input.name === undefined && input.editScope !== undefined) {
        throw new AppError(
          'COMMON_INVALID_INPUT',
          'editScope는 이름을 변경할 때만 지정할 수 있습니다.',
        );
      }
    } else if (input.editScope !== undefined) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '다중 마일스톤이 아니면 editScope를 지정할 수 없습니다.',
      );
    }

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

    const data = {
      name: input.name,
      isCompleted: input.isCompleted,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate:
        input.endDate !== undefined
          ? input.endDate
            ? new Date(input.endDate)
            : null
          : undefined,
    };

    // ALL: 지정 회차는 전체 필드, 나머지 미래 미완료 회차에는 이름만 전파(한 트랜잭션).
    if (input.editScope === 'ALL' && existing.seriesId !== null) {
      return milestoneRepository.updateWithSeriesName(milestoneId, data, {
        seriesId: existing.seriesId,
        fromDate: kstToday(),
        name: input.name!, // 위 규칙상 ALL이면 name이 반드시 존재
      });
    }

    return milestoneRepository.update(milestoneId, data);
  },

  // 삭제 (PLB-014, 하위 task는 CASCADE).
  // - MULTIPLE는 deleteScope 필수 택1(기본값 없음): THIS_ONLY=해당 회차 1건,
  //   ALL=해당 회차 + 같은 seriesId의 "오늘 이후 + 미완료" 회차 일괄(완료된 과거 회차 보존).
  // - SINGLE/RANGE에는 deleteScope를 지정할 수 없다.
  async deleteMilestone(userId: number, milestoneId: number, deleteScope?: string) {
    const existing = await getOwnedMilestoneOrThrow(userId, milestoneId);

    if (existing.dateType === 'MULTIPLE') {
      if (deleteScope !== 'THIS_ONLY' && deleteScope !== 'ALL') {
        throw new AppError(
          'COMMON_INVALID_INPUT',
          '다중 마일스톤 삭제에는 deleteScope(THIS_ONLY 또는 ALL)를 지정해야 합니다.',
        );
      }
      if (deleteScope === 'ALL' && existing.seriesId !== null) {
        await milestoneRepository.deleteWithSeries(
          milestoneId,
          existing.seriesId,
          kstToday(),
        );
        return;
      }
      await milestoneRepository.delete(milestoneId);
      return;
    }

    if (deleteScope !== undefined) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '다중 마일스톤이 아니면 deleteScope를 지정할 수 없습니다.',
      );
    }

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
    // 개수 일치 + 전부 이 카테고리 소속 + 중복 없음 = 전체 목록의 순열임이 보장된다.
    // 일부만 보내면 누락분이 기존 순번을 유지해 displayOrder가 겹치므로 거부한다.
    if (hasDuplicate || !allInCategory || orderedIds.length !== all.length) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '해당 카테고리의 전체 마일스톤 ID를 누락·중복 없이 보내야 합니다.',
      );
    }

    await milestoneRepository.reorder(orderedIds);
  },
};