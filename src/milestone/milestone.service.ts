// Milestone Service
// 비즈니스 로직 계층. 접근 권한(2-hop: milestone→category)·날짜 규칙·scope 규칙을 담당한다.
// 마일스톤은 자체 소유자 컬럼이 없어 상위 카테고리로 권한을 판정한다 — 오너뿐 아니라
// 초대를 수락(ACCEPTED)한 공유 멤버도 동등하게 편집할 수 있다 (PLB-045).
// MULTIPLE(다중 날짜)는 선택한 날짜마다 실제 row(회차)로 저장되며 같은 seriesId를 공유한다.

import { AppError } from '../utils/app-error';
import { getMonthRangeKST } from '../utils/date';
import { isAcceptedSharedMember } from '../shared/shared.service';
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
  categoryId?: number; // 지정 시 카테고리 이동(#86). 현재와 같은 값이면 변경 없음
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

// 마일스톤 단건 접근 검증(2-hop). 없으면 404, 상위 카테고리의 오너도 아니고
// 초대를 수락(ACCEPTED)한 공유 멤버도 아니면 403.
// 공유 멤버 판정은 shared 도메인의 isAcceptedSharedMember를 재사용한다 — categoryService가
// 카테고리 단건에 쓰는 것과 같은 판정을 마일스톤에도 그대로 적용해 규칙이 갈리지 않게 한다.
// (목록·생성·순서 변경은 categoryService.getCategory를 재사용하므로 이 함수를 거치지 않는다.)
async function getAccessibleMilestoneOrThrow(userId: number, milestoneId: number) {
  const milestone = await milestoneRepository.findByIdWithCategory(milestoneId);
  if (!milestone) {
    throw new AppError('COMMON_NOT_FOUND', '마일스톤을 찾을 수 없습니다.');
  }
  if (
    milestone.category.userId !== userId &&
    !(await isAcceptedSharedMember(userId, milestone.categoryId))
  ) {
    throw new AppError('COMMON_FORBIDDEN', '해당 마일스톤에 접근할 권한이 없습니다.');
  }
  return milestone;
}

// 날짜 타입 변경(#84). URL로 지정한 회차를 앵커로 삼아 그대로 갱신하므로 milestoneId가 유지되고,
// 하위 태스크와 완료 상태도 보존된다(태스크 도메인이 taskId를 유지하는 방식에 맞춤).
// 표시 순서만은 새 날짜 기준으로 다시 잡는다(옛 날짜 기준 자리를 유지하면 목록이 D-Day 순과 어긋난다).
// MULTIPLE에서 벗어날 때는 같은 seriesId의 "나머지" 회차가 정리 대상이다. 완료된 과거 회차도
// 함께 정리되는데, 다중 일정 자체가 다른 형태로 바뀌므로 남겨두면 고아 회차가 되기 때문이다.
// 정리되는 회차에 달려 있던 태스크는 삭제되지 않고 앵커로 이관된다.
//
// 하위 태스크의 "날짜"는 의도적으로 건드리지 않는다(2026-07-30 기획 확정). 마일스톤을
// 7/27~8/1에서 7/15 하루로 바꾸면 7/30짜리 하위 태스크는 그대로 7/30에 남아 마일스톤
// 기간 밖에 놓인다. 태스크를 마일스톤 기간 안으로만 제한하면 활용도가 지나치게 떨어진다는
// 판단이라, 정합성을 맞추겠다고 태스크 날짜를 옮기거나 지우지 않는다.
async function changeDateType(
  existing: {
    id: number;
    categoryId: number;
    name: string;
    dateType: string;
    seriesId: number | null;
  },
  input: UpdateMilestoneInput,
  moveToCategoryId?: number, // 함께 요청된 카테고리 이동(#86). 같은 트랜잭션에서 처리된다.
) {
  return milestoneRepository.changeDateType({
    anchorId: existing.id,
    // 정리 대상 회차는 repository가 트랜잭션 안에서 이 키로 조회한다(경합 시 고아 회차 방지).
    seriesId: seriesKey(existing),
    categoryId: existing.categoryId,
    name: input.name ?? existing.name, // 이름을 안 보내면 기존 이름 유지
    dateType: input.dateType!, // 호출 전 분기에서 존재가 보장된다
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    dates: input.dates ? input.dates.map((d) => new Date(d)) : null,
    moveToCategoryId,
  });
}

// 시리즈 회차를 한 덩어리로 다뤄야 하는 작업(전환 시 정리, 이동)에 넘길 시리즈 키.
// MULTIPLE가 아니면 null이고, 그때는 해당 row 하나만 대상이 된다.
// 실제 회차 목록은 repository가 트랜잭션 안에서 이 키로 조회한다. 목록을 밖에서 확정하면
// 그 사이 회차가 늘어났을 때 고아 회차(전환)나 두 카테고리로 흩어진 시리즈(이동)가 남는다.
// editScope(이름 전파 범위)와는 무관하게 항상 시리즈 전체가 대상이다.
function seriesKey(row: { dateType: string; seriesId: number | null }) {
  return row.dateType === 'MULTIPLE' ? row.seriesId : null;
}

export const milestoneService = {
  // 카테고리 하위 마일스톤 목록. 상위 카테고리 소유 검증(categoryService 재사용)이 선행된다.
  async getMilestones(userId: number, categoryId: number) {
    await categoryService.getCategory(userId, categoryId); // 404/403 판정 재사용
    const milestones = await milestoneRepository.findManyByCategoryId(categoryId);
    return milestones.map(toMilestoneResponse);
  },

  // 월별 마일스톤 목록. 카테고리 구분 없이 조회 월에 걸치는 마일스톤을 한 번에 반환한다.
  //
  // 사이드바가 월 화면을 조립할 때 GET /tasks와 짝으로 쓰라고 만든 조회다. 기존
  // GET /categories/{id}/milestones는 월 필터가 없어서, 프론트가 월별 화면을 태스크만으로 조립하면
  // "7월 마일스톤만 있고 태스크는 없는 카테고리"가 7월에도 빈 카테고리로 보이게 된다.
  //
  // 접근 범위 검증을 서비스에서 따로 하지 않는 이유: 대상이 카테고리 전체라 단건 판정
  // (getCategory)을 걸 지점이 없고, repository의 where가 이미 "내 카테고리 + ACCEPTED 공유
  // 카테고리"로 범위를 좁힌다. 권한 없는 마일스톤은 애초에 결과에 들어오지 않는다.
  async getMonthlyMilestones(userId: number, baseDate?: string) {
    const { monthStart, nextMonthStart } = getMonthRangeKST(baseDate);
    const milestones = await milestoneRepository.findManyByMonth(
      userId,
      monthStart,
      nextMonthStart,
    );
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
    // 회차 전체가 같은 작성자를 갖는다 — 한 번의 생성 요청으로 만들어진 하나의 마일스톤이다.
    if (input.dateType === 'MULTIPLE') {
      const milestones = await milestoneRepository.createMultiple({
        categoryId,
        createdByUserId: userId,
        name: input.name,
        dates: (input.dates ?? []).map((d) => new Date(d)),
      });
      return { milestones: milestones.map(toMilestoneResponse) };
    }

    const milestone = await milestoneRepository.create({
      categoryId,
      createdByUserId: userId,
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
  // - categoryId가 현재와 다르면 카테고리 이동이 함께 수행된다(#86). 이름·날짜 수정과 같이 보낼 수 있고,
  //   MULTIPLE는 회차 전체가 함께 옮겨진다.
  // - dateType이 오면 날짜 타입 변경 경로로 빠진다(#84).
  //   응답은 태스크 수정과 같이 "수정한 리소스 1건"이며, MULTIPLE인 경우에만 회차 전체를
  //   series로 동봉한다(태스크가 taskDates를 동봉하는 것과 같은 형태).
  async updateMilestone(
    userId: number,
    milestoneId: number,
    input: UpdateMilestoneInput,
  ) {
    const existing = await getAccessibleMilestoneOrThrow(userId, milestoneId);

    // 카테고리 이동(#86). 같은 값이면 변경이 없으므로 이동하지 않는다(수정 모달이 폼 전체를
    // 보내는 경우가 있다). 대상 카테고리 접근 검증은 여기서 먼저 해서(없으면 404, 권한 없으면 403)
    // 이름·날짜가 반영되기 전에 막는다. 실제 이동은 이름·날짜 수정을 마친 뒤 마지막에 수행한다 —
    // 폼 전체 전송이면 날짜도 함께 바뀌는데, 바뀐 startDate 기준으로 대상 카테고리의 순번을
    // 채번해야 목록이 D-Day 순으로 정리되기 때문이다.
    const moveTo =
      input.categoryId !== undefined && input.categoryId !== existing.categoryId
        ? input.categoryId
        : undefined;
    if (moveTo !== undefined) {
      // 공유 카테고리 밖으로 옮기면 나머지 멤버의 목록에서 그 마일스톤이 사라진다 —
      // 그들 입장에서는 삭제와 다르지 않다. 카테고리 삭제를 오너 전용으로 둔 것과 같은 이유로
      // 반출도 오너만 할 수 있게 한다. 공유 카테고리 "안에서의" 수정은 멤버도 그대로 가능하다.
      // 정책 미확정 구간이라 보수적으로 막아둔 것이다 — 멤버 반출을 허용하기로 정해지면
      // 이 분기만 지우면 된다.
      if (existing.category.isShared && existing.category.userId !== userId) {
        throw new AppError(
          'COMMON_FORBIDDEN',
          '공유 카테고리의 마일스톤은 오너만 다른 카테고리로 옮길 수 있습니다.',
        );
      }
      await categoryService.getCategory(userId, moveTo); // 404/403 판정 재사용
    }

    // 날짜 타입 변경: 같은 타입을 다시 골라도 날짜는 통째로 새로 지정되므로 동일하게 처리한다.
    // 아래 부분 수정 규칙(editScope·endDate 정합성)은 기존 dateType 유지가 전제라 여기서 갈라진다.
    if (input.dateType !== undefined) {
      // 이동이 함께 오면 changeDateType이 같은 트랜잭션 안에서 끝까지 처리한다.
      const rows = await changeDateType(existing, input, moveTo);
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

    // ALL: 지정 회차는 전체 필드, 나머지 미래 미완료 회차에는 이름만 전파.
    const series =
      input.editScope === 'ALL' && existing.seriesId !== null
        ? {
            seriesId: existing.seriesId,
            fromDate: kstToday(),
            name: input.name!, // 위 규칙상 ALL이면 name이 반드시 존재
          }
        : undefined;

    // 이동이 함께 오면 수정과 이동을 한 트랜잭션으로 처리한다(#86).
    // 나누면 이동에서 실패했을 때 이름·날짜만 반영된 상태가 남는다.
    if (moveTo !== undefined) {
      const moved = await milestoneRepository.updateWithMove({
        milestoneId,
        // 이동 대상 회차는 repository가 트랜잭션 안에서 이 키로 조회한다.
        seriesId: seriesKey(existing),
        data,
        series,
        targetCategoryId: moveTo,
      });
      return toMilestoneResponse(moved);
    }

    const updated = series
      ? await milestoneRepository.updateWithSeriesName(milestoneId, data, series)
      : await milestoneRepository.update(milestoneId, data);
    return toMilestoneResponse(updated);
  },

  // 삭제 (PLB-014).
  // - 하위 태스크는 함께 삭제되지 않고 카테고리 직속 태스크로 남는다(프론트 확정 정책).
  //   Task.milestoneId가 onDelete: Cascade라 그냥 지우면 완료된 태스크까지 함께 사라지므로,
  //   repository가 삭제 전에 milestoneId를 비워 카테고리 직속으로 내보낸다.
  // - MULTIPLE는 deleteScope 필수 택1(기본값 없음): THIS_ONLY=해당 회차 1건,
  //   ALL=해당 회차 + 같은 seriesId의 "오늘 이후 + 미완료" 회차 일괄(완료된 과거 회차 보존).
  //   ALL은 정리되는 회차 전부의 하위 태스크가 직속으로 내려온다.
  // - SINGLE/RANGE에는 deleteScope를 지정할 수 없다.
  async deleteMilestone(userId: number, milestoneId: number, deleteScope?: string) {
    const existing = await getAccessibleMilestoneOrThrow(userId, milestoneId);

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
          existing.categoryId,
        );
        return;
      }
      await milestoneRepository.delete(milestoneId, existing.categoryId);
      return;
    }

    if (deleteScope !== undefined) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '다중 마일스톤이 아니면 deleteScope를 지정할 수 없습니다.',
      );
    }

    await milestoneRepository.delete(milestoneId, existing.categoryId);
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