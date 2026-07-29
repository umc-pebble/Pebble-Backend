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
  categoryId?: number; // 이동 미지원. 현재 카테고리와 같은 값만 허용(폼 전체 전송 호환)
  dateType?: 'SINGLE' | 'RANGE' | 'MULTIPLE'; // 지정 시 "날짜 재지정" 경로
  startDate?: string;
  endDate?: string | null;
  dates?: string[] | null; // MULTIPLE로 재지정할 때만
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

// @db.Date 값은 Prisma에서 UTC 자정 Date로 오가므로 ISO 문자열 앞 10자리가 곧 그 날짜다.
// 태스크 도메인과 동일한 'YYYY-MM-DD' 문자열로 내보낸다(Swagger의 Milestone 스키마 표기와도 일치).
function toDateString(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

// 응답 직렬화. 날짜 두 필드만 문자열로 바꾸고 나머지 컬럼은 그대로 둔다.
function toMilestoneResponse<T extends { startDate: Date; endDate: Date | null }>(
  milestone: T,
) {
  return {
    ...milestone,
    startDate: toDateString(milestone.startDate)!, // NOT NULL 컬럼이라 항상 값이 있다
    endDate: toDateString(milestone.endDate),
  };
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

// 날짜 타입 변경(#84). URL로 지정한 회차를 앵커로 삼아 그대로 갱신하므로 milestoneId가 유지되고,
// 하위 태스크·완료 상태·표시 순서도 보존된다(태스크 도메인이 taskId를 유지하는 방식에 맞춤).
// MULTIPLE에서 벗어날 때는 같은 seriesId의 "나머지" 회차가 정리 대상이다. 완료된 과거 회차도
// 함께 정리되는데, 다중 일정 자체가 다른 형태로 바뀌므로 남겨두면 고아 회차가 되기 때문이다.
// 정리되는 회차에 달려 있던 태스크는 삭제되지 않고 앵커로 이관된다.
async function changeDateType(
  existing: {
    id: number;
    categoryId: number;
    name: string;
    dateType: string;
    seriesId: number | null;
  },
  input: UpdateMilestoneInput,
) {
  const siblingIds =
    existing.dateType === 'MULTIPLE' && existing.seriesId !== null
      ? (await milestoneRepository.findIdsBySeriesId(existing.seriesId)).filter(
          (id) => id !== existing.id,
        )
      : [];

  return milestoneRepository.changeDateType({
    anchorId: existing.id,
    siblingIds,
    categoryId: existing.categoryId,
    name: input.name ?? existing.name, // 이름을 안 보내면 기존 이름 유지
    dateType: input.dateType!, // 호출 전 분기에서 존재가 보장된다
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    dates: input.dates ? input.dates.map((d) => new Date(d)) : null,
  });
}

export const milestoneService = {
  // 카테고리 하위 마일스톤 목록. 상위 카테고리 소유 검증(categoryService 재사용)이 선행된다.
  async getMilestones(userId: number, categoryId: number) {
    await categoryService.getCategory(userId, categoryId); // 404/403 판정 재사용
    const milestones = await milestoneRepository.findManyByCategoryId(categoryId);
    return milestones.map(toMilestoneResponse);
  },

  // 친구 프로필 조회(#64): 친구(또는 본인)의 공개 카테고리 하위 마일스톤 목록.
  // 친구 접근 판정 + 공개 카테고리 검증은 categoryService에 위임한다(마일스톤은 카테고리로 소유·공개를 판정).
  // 비공개 카테고리는 categoryService가 404로 막으므로 여기서 별도 처리는 필요 없다.
  async getFriendMilestones(requesterId: number, targetUserId: number, categoryId: number) {
    await categoryService.getFriendPublicCategory(requesterId, targetUserId, categoryId);
    const milestones = await milestoneRepository.findManyByCategoryId(categoryId);
    return milestones.map(toMilestoneResponse);
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
      return { milestones: milestones.map(toMilestoneResponse) };
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
    return { milestones: [toMilestoneResponse(milestone)] };
  },

  // 수정 (PLB-013).
  // - editScope는 "MULTIPLE의 이름 수정"에만 쓰인다(모달 필수 택1, 기본값 없음).
  //   날짜(startDate)·완료(isCompleted)는 scope 없이 항상 해당 회차 1건에만 적용된다
  //   (날짜 수정은 모달이 뜨지 않음, 완료는 회차별 독립 기록).
  // - editScope=ALL은 같은 seriesId 중 "오늘 이후 + 미완료" 회차에 이름을 전파한다
  //   (완료된 과거 회차는 보존).
  // - dateType이 오면 날짜 타입 변경 경로로 빠진다(#84).
  //   응답은 태스크 수정과 같이 "수정한 리소스 1건"이며, MULTIPLE인 경우에만 회차 전체를
  //   series로 동봉한다(태스크가 taskDates를 동봉하는 것과 같은 형태).
  async updateMilestone(
    userId: number,
    milestoneId: number,
    input: UpdateMilestoneInput,
  ) {
    const existing = await getOwnedMilestoneOrThrow(userId, milestoneId);

    // 카테고리 이동은 미지원. 같은 값이면 변경이 없으므로 통과시키고(수정 모달이 폼 전체를
    // 보내는 경우가 있다), 다른 값일 때만 막는다. 조용히 무시하면 프론트에서 "카테고리가
    // 안 바뀐다"는 증상만 남아 원인을 찾기 어렵다.
    if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '마일스톤의 소속 카테고리는 수정할 수 없습니다.',
      );
    }

    // 날짜 타입 변경: 같은 타입을 다시 골라도 날짜는 통째로 새로 지정되므로 동일하게 처리한다.
    // 아래 부분 수정 규칙(editScope·endDate 정합성)은 기존 dateType 유지가 전제라 여기서 갈라진다.
    if (input.dateType !== undefined) {
      const rows = await changeDateType(existing, input);
      const milestones = rows.map(toMilestoneResponse);
      const anchor = milestones[0];
      return input.dateType === 'MULTIPLE' ? { ...anchor, series: milestones } : anchor;
    }

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
      const updated = await milestoneRepository.updateWithSeriesName(milestoneId, data, {
        seriesId: existing.seriesId,
        fromDate: kstToday(),
        name: input.name!, // 위 규칙상 ALL이면 name이 반드시 존재
      });
      return toMilestoneResponse(updated);
    }

    return toMilestoneResponse(await milestoneRepository.update(milestoneId, data));
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