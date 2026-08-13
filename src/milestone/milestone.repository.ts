// Milestone Repository
// DB 접근 계층. Prisma 쿼리만 담당한다. 소유권(2-hop)·범위 규칙은 milestoneService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

// 트랜잭션 클라이언트 타입 (prisma.$transaction 콜백 인자)
type Tx = Prisma.TransactionClient;

interface CreateRowInput {
  categoryId: number;
  createdByUserId: number;
  name: string;
  dateType: 'SINGLE' | 'RANGE' | 'MULTIPLE';
  startDate: Date;
  endDate: Date | null;
  seriesId: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// FOR UPDATE 잠금 경합에서 갭 락 교착(deadlock)이 가능해 짧은 재시도를 둔다.
// 즉시 재시도하면 충돌했던 트랜잭션끼리 같은 시점에 다시 부딪히므로,
// 재시도 전에 지수 백오프(20·40ms)에 랜덤 지터(0~25ms)를 더해 재경합을 줄인다.
async function withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const isDeadlock =
        (e as { code?: string }).code === 'P2034' || /deadlock/i.test(message);
      if (!isDeadlock || attempt >= 3) throw e;
      await sleep(20 * 2 ** (attempt - 1) + Math.floor(Math.random() * 25));
    }
  }
}

// 다중은 한 번에 최대 100회차까지 만들 수 있어 트랜잭션이 길어질 수 있으므로
// Prisma 기본 5초 타임아웃 대신 여유를 둔다.
const TX_OPTIONS = { maxWait: 5_000, timeout: 20_000 };

// 기본 정렬 "D-Day 가까운 순"(PLB-016)을 채번 시점에 보장한다:
// 카테고리의 마일스톤을 displayOrder 순으로 잠근 뒤(FOR UPDATE, 동시 생성 직렬화),
// 새 날짜보다 늦은 첫 행 앞에 끼워 넣는다. 더 늦은 행이 없으면 맨 뒤에 붙인다.
// 사용자가 드래그로 바꾼 순서는 그대로 존중되고, 손대지 않은 목록은 자연히 날짜 오름차순이 된다.
//
// 날짜가 여러 개일 때 이 과정을 한 건씩 반복하면 SELECT ... FOR UPDATE와 updateMany가
// 날짜 수만큼 되풀이되어, 그동안 카테고리 전체 락이 유지된다. 그래서 잠금·조회는 한 번만 하고
// 최종 순번을 메모리에서 계산한 뒤, 밀어야 할 양이 같은 행끼리 묶어 updateMany로 반영한다
// (DB 왕복 횟수가 날짜 개수와 무관해진다).
//
// 자리만 계산하고 row 자체는 건드리지 않으므로 생성·날짜 타입 변경·카테고리 이동이
// 같은 규칙을 공유한다.
//
// excludeIds는 순서 계산에서 빼둘 행이다. 날짜가 바뀌어 자리를 다시 잡아야 하는 앵커가 해당하며,
// 빼두면 남은 행들 사이에 새 날짜 기준으로 다시 끼워 넣게 된다.
// 반환값은 dates를 오름차순 정렬했을 때 각 날짜가 가져갈 displayOrder다.
async function reserveDateOrderSlots(
  tx: Tx,
  categoryId: number,
  dates: Date[],
  excludeIds: number[] = [],
): Promise<number[]> {
  const locked = await tx.$queryRaw<
    { id: number; displayOrder: number; startDate: Date }[]
  >`SELECT id, displayOrder, startDate FROM Milestone
    WHERE categoryId = ${categoryId}
    ORDER BY displayOrder ASC FOR UPDATE`;

  const excluded = new Set(excludeIds);
  // id가 null인 항목이 이번에 자리를 잡는 새 날짜다.
  const list: { id: number | null; time: number }[] = locked
    .filter((r) => !excluded.has(r.id))
    .map((r) => ({ id: r.id, time: r.startDate.getTime() }));

  // 오름차순으로 넣으면 앞서 넣은 새 날짜는 "늦은 행" 조건에 걸리지 않아 서로 자리를 뺏지 않는다.
  for (const date of [...dates].sort((a, b) => a.getTime() - b.getTime())) {
    const time = date.getTime();
    const at = list.findIndex((r) => r.time > time);
    const slot = { id: null, time };
    if (at === -1) list.push(slot);
    else list.splice(at, 0, slot);
  }

  // 기존 행은 순번이 실제로 바뀐 것만 갱신한다(증감량이 같은 행끼리 한 번에).
  const currentOrder = new Map(locked.map((r) => [r.id, r.displayOrder]));
  const byDelta = new Map<number, number[]>();
  list.forEach((item, index) => {
    if (item.id === null) return;
    const delta = index - currentOrder.get(item.id)!;
    if (delta !== 0) byDelta.set(delta, [...(byDelta.get(delta) ?? []), item.id]);
  });
  for (const [delta, ids] of byDelta) {
    await tx.milestone.updateMany({
      where: { id: { in: ids } },
      data: { displayOrder: { increment: delta } },
    });
  }

  return list.reduce<number[]>((slots, item, index) => {
    if (item.id === null) slots.push(index);
    return slots;
  }, []);
}

// MULTIPLE 회차 row 묶음 생성. seriesId는 별도 시퀀스 없이 "첫 회차의 id"를 재사용하므로
// 첫 회차만 단건 생성해 id를 얻고, 나머지 회차는 createMany로 한 번에 만든다.
// 트랜잭션은 호출자가 열어 전달한다(일부 회차만 생성되는 상태 방지).
// 반환 배열의 0번은 항상 가장 이른 날짜의 회차다.
async function createSeriesRows(
  tx: Tx,
  input: { categoryId: number; createdByUserId: number; name: string; dates: Date[] },
) {
  const sorted = [...input.dates].sort((a, b) => a.getTime() - b.getTime());
  const slots = await reserveDateOrderSlots(tx, input.categoryId, sorted);

  const first = await tx.milestone.create({
    data: {
      categoryId: input.categoryId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      dateType: 'MULTIPLE',
      startDate: sorted[0],
      endDate: null,
      displayOrder: slots[0],
    },
  });
  const seriesId = first.id;
  await tx.milestone.update({ where: { id: seriesId }, data: { seriesId } });

  if (sorted.length > 1) {
    await tx.milestone.createMany({
      data: sorted.slice(1).map((date, i) => ({
        categoryId: input.categoryId,
        createdByUserId: input.createdByUserId,
        name: input.name,
        dateType: 'MULTIPLE' as const,
        startDate: date,
        endDate: null,
        seriesId,
        displayOrder: slots[i + 1],
      })),
    });
  }

  return tx.milestone.findMany({ where: { seriesId }, orderBy: { startDate: 'asc' } });
}

// editScope=ALL에서 이름을 전파할 범위 (PLB-013).
interface SeriesNameSpread {
  seriesId: number;
  fromDate: Date;
  name: string;
}

// 단건 수정 + (editScope=ALL이면) 같은 seriesId의 "fromDate 이후 + 미완료" 회차에 이름 전파.
// 완료된 과거 회차는 보존한다. 트랜잭션은 호출자가 연다.
async function applyUpdate(
  tx: Tx,
  milestoneId: number,
  data: Prisma.MilestoneUncheckedUpdateInput,
  series?: SeriesNameSpread,
) {
  const updated = await tx.milestone.update({ where: { id: milestoneId }, data });
  if (series) {
    await tx.milestone.updateMany({
      where: {
        seriesId: series.seriesId,
        id: { not: milestoneId },
        startDate: { gte: series.fromDate },
        isCompleted: false,
      },
      data: { name: series.name },
    });
  }
  return updated;
}

// 카테고리 이동(#86). 마일스톤 row와 그 하위 태스크를 대상 카테고리로 옮긴다.
// - 태스크의 categoryId를 함께 옮기는 이유: 태스크 생성이 "마일스톤이 그 카테고리에 속하는지"를
//   검증하므로(task.repository의 findMilestoneByIdAndCategoryIdAndUserId), 마일스톤만 옮기면
//   하위 태스크를 더 만들 수 없는 상태가 된다. milestoneId는 그대로 둔다(관계 자체는 안 변함).
// - displayOrder는 대상 카테고리 안에서 다시 채번한다. 기존 순번을 들고 가면 그 카테고리의
//   다른 마일스톤과 겹친다. 옮기는 행은 아직 대상 카테고리에 없으므로 excludeIds가 필요 없고,
//   날짜 전체의 자리를 한 번에 확보한다(회차마다 잠그면 대상 카테고리 락이 오래 유지된다).
// - MULTIPLE의 회차 전체를 넘기는 것은 호출자(service)의 책임이다.
//
// 트랜잭션은 호출자가 연다. 이름·날짜 수정과 함께 들어오면 같은 트랜잭션에서 수정 뒤에 호출해야
// 바뀐 startDate 기준으로 순번이 잡히고, 중간에 실패해도 수정만 남는 상태가 생기지 않는다.
async function applyMove(tx: Tx, milestoneIds: number[], targetCategoryId: number) {
  const rows = await tx.milestone.findMany({
    where: { id: { in: milestoneIds } },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });

  // rows는 startDate 오름차순이고 slots도 같은 기준으로 정렬되어 나오므로 인덱스가 대응한다.
  const slots = await reserveDateOrderSlots(
    tx,
    targetCategoryId,
    rows.map((row) => row.startDate),
  );
  for (const [index, row] of rows.entries()) {
    await tx.milestone.update({
      where: { id: row.id },
      data: { categoryId: targetCategoryId, displayOrder: slots[index] },
    });
  }

  await tx.task.updateMany({
    where: { milestoneId: { in: milestoneIds } },
    data: { categoryId: targetCategoryId },
  });

  return tx.milestone.findMany({
    where: { id: { in: milestoneIds } },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });
}

// 마일스톤 삭제 전에 하위 태스크를 카테고리 직속 태스크로 내보낸다(프론트 확정 정책).
// Task.milestoneId가 onDelete: Cascade라, 옮기지 않고 마일스톤을 지우면 하위 태스크가
// 완료된 것까지 통째로 함께 삭제된다. 그래서 삭제 경로는 반드시 이 함수를 먼저 거친다.
//
// displayOrder를 다시 채번하는 이유: 태스크의 순번은 (categoryId, milestoneId) 조합 단위로
// 매겨진다(task.repository의 getNextTaskDisplayOrder). 옮긴 태스크가 마일스톤 시절의 순번을
// 그대로 들고 오면 이미 직속에 있던 태스크와 번호가 겹쳐, 목록 순서가 조회할 때마다 달라진다.
// 직속 버킷의 맨 뒤에 이어 붙이고, 옮기는 태스크끼리의 상대 순서는 그대로 유지한다.
// 채번 중 같은 카테고리에 태스크가 새로 생기면 번호가 또 겹치므로, task.repository의
// lockTaskDisplayOrder와 같은 대상(카테고리 row)을 FOR UPDATE로 잠가 직렬화한다.
//
// categoryId는 호출자가 마일스톤에서 읽어 넘긴다. 하위 태스크는 그 마일스톤과 같은 카테고리에
// 있다는 것이 도메인 불변식이라(applyMove도 같은 전제로 태스크의 categoryId를 함께 옮긴다)
// 여기서도 명시적으로 다시 써준다 — 혹시 어긋난 행이 있어도 이 시점에 바로잡힌다.
//
// 트랜잭션은 호출자가 연다. 삭제와 같은 트랜잭션이어야 "태스크만 떨어져 나오고 마일스톤은
// 남은" 중간 상태가 생기지 않는다.
async function detachTasksToCategory(
  tx: Tx,
  milestoneIds: number[],
  categoryId: number,
) {
  if (milestoneIds.length === 0) return;

  await tx.$queryRaw`SELECT id FROM Category WHERE id = ${categoryId} FOR UPDATE`;

  const tasks = await tx.task.findMany({
    where: { milestoneId: { in: milestoneIds } },
    select: { id: true, displayOrder: true },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  });
  if (tasks.length === 0) return;

  const max = await tx.task.aggregate({
    where: { categoryId, milestoneId: null },
    _max: { displayOrder: true },
  });

  // 직속 태스크의 채번은 1부터 시작한다(getNextTaskDisplayOrder의 `(max ?? 0) + 1`).
  // 태스크마다 update를 돌리면 옮기는 개수만큼 왕복이 생기고, 그동안 위에서 잠근 카테고리 row가
  // 계속 물려 있어 같은 카테고리의 태스크 생성이 전부 대기한다(deleteScope=ALL이면 회차 수만큼 늘어난다).
  // 최종 순번은 위 정렬로 이미 확정되므로, 밀어야 할 양(delta)이 같은 행끼리 묶어 updateMany로 반영한다
  // — reserveDateOrderSlots가 마일스톤 순번에 쓰는 방식과 같다.
  // 다만 여기서는 delta가 0인 묶음도 건너뛰면 안 된다. 순번이 그대로여도 milestoneId를 떼는 갱신이 필요하다.
  const start = (max._max.displayOrder ?? 0) + 1;
  const byDelta = new Map<number, number[]>();
  tasks.forEach((task, index) => {
    const delta = start + index - task.displayOrder;
    byDelta.set(delta, [...(byDelta.get(delta) ?? []), task.id]);
  });
  for (const [delta, ids] of byDelta) {
    await tx.task.updateMany({
      where: { id: { in: ids } },
      data: { milestoneId: null, categoryId, displayOrder: { increment: delta } },
    });
  }
}

export const milestoneRepository = {
  // 카테고리에 속한 마일스톤 목록. 수동 순서(displayOrder) 우선, 같으면 D-Day(startDate) 순.
  findManyByCategoryId(categoryId: number) {
    return prisma.milestone.findMany({
      where: { categoryId },
      orderBy: [{ displayOrder: 'asc' }, { startDate: 'asc' }],
    });
  },

  // 친구 프로필 조회 중 "친구가 소유하지 않은" 공유 카테고리를 볼 때 쓴다.
  // 그 카테고리에는 오너와 다른 멤버가 만든 마일스톤이 섞여 있는데, 친구 프로필은 어디까지나
  // 그 친구의 일정을 보는 화면이라 작성자가 대상 유저인 것만 골라야 한다
  // (친구 소유 카테고리는 카테고리 소유자에게 귀속시키므로 findManyByCategoryId를 그대로 쓴다 —
  // follow.repository의 findFriendIdsWithTodaySchedule에 적힌 귀속 규칙과 같은 기준이다).
  //
  // createdByUserId가 NULL인 행(컬럼 도입 이전 생성분·작성자 탈퇴)은 대상에서 빠진다.
  // 작성자를 확인할 수 없는 항목을 남의 프로필에 띄우는 것보다 감추는 쪽이 안전하다.
  findManyByCategoryIdAndCreator(categoryId: number, createdByUserId: number) {
    return prisma.milestone.findMany({
      where: { categoryId, createdByUserId },
      orderBy: [{ displayOrder: 'asc' }, { startDate: 'asc' }],
    });
  },

  // 월별 마일스톤 목록(사이드바 조립용). 카테고리를 가리지 않고 "조회 월에 걸치는" 마일스톤만
  // 한 번에 반환한다 — 카테고리마다 findManyByCategoryId를 부르면 N번 왕복이 되기 때문이다.
  //
  // 접근 판정은 GET /categories(findVisibleByUserId)와 같다: 내 카테고리 + 초대를 수락(ACCEPTED)한
  // 공유 카테고리. 마일스톤은 userId 컬럼이 없어 카테고리 접근 권한이 곧 마일스톤 접근 권한이므로,
  // 이 범위가 그대로 "현재 로그인 사용자가 접근 가능한 마일스톤"이 된다.
  //
  // 다만 숨김(isHidden) 처리는 두 조회가 의도적으로 다르다. 카테고리 목록은 숨긴 카테고리도
  // 그대로 반환한다 — 사용자가 숨김을 해제하려면 목록에 보여야 하기 때문이다. 반면 여기는
  // "달력에 그릴 일정"을 주는 조회라 숨긴 카테고리의 마일스톤을 빼야 하고, 이는 태스크 월별
  // 조회(findTasksByMonth)가 같은 이유로 isHidden을 거르는 것과 맞춘 것이다.
  //
  // 월 판정이 태스크쪽과 다른 점: MULTIPLE(다중)이 회차마다 Milestone row로 저장되고 각자
  // startDate를 가지므로, 태스크의 taskDates 자식 탐색(`some`)에 해당하는 절이 필요 없고
  // SINGLE과 똑같이 startDate 하나만 보면 된다.
  findManyByMonth(userId: number, monthStart: Date, nextMonthStart: Date) {
    return prisma.milestone.findMany({
      where: {
        category: {
          isHidden: false,
          OR: [{ userId }, { members: { some: { userId, status: 'ACCEPTED' } } }],
        },
        OR: [
          // SINGLE·MULTIPLE: 날짜가 하나뿐이라 그 날짜가 조회 월에 속하는지만 본다.
          {
            dateType: { in: ['SINGLE', 'MULTIPLE'] },
            startDate: { gte: monthStart, lt: nextMonthStart },
          },
          // RANGE: 기간이 조회 월과 하루라도 겹치면 포함.
          {
            dateType: 'RANGE',
            startDate: { lt: nextMonthStart },
            endDate: { gte: monthStart },
          },
          // endDate는 스키마상 nullable이라 RANGE인데 비어 있는 행이 있을 수 있다.
          // 위 겹침 조건은 endDate가 NULL이면 통째로 탈락하므로, 그런 행은 시작일 하루짜리로 본다
          // (조건을 빼면 해당 마일스톤이 어느 달에서도 조회되지 않아 화면에서 사라진다).
          {
            dateType: 'RANGE',
            endDate: null,
            startDate: { gte: monthStart, lt: nextMonthStart },
          },
        ],
      },
      // 카테고리별로 묶어서 내려보낸다(프론트가 categoryId로 그룹핑). 카테고리 안의 순서는
      // findManyByCategoryId와 동일하게 수동 순서(displayOrder) 우선, 같으면 D-Day 순이라
      // 월별 화면과 카테고리 상세 화면의 정렬이 어긋나지 않는다.
      // displayOrder는 카테고리 단위로 채번되므로 categoryId를 먼저 두지 않으면 정렬이 섞인다.
      orderBy: [
        { categoryId: 'asc' },
        { displayOrder: 'asc' },
        { startDate: 'asc' },
        { id: 'asc' },
      ],
    });
  },

  // 단건 + 상위 카테고리 동봉. 소유권 판정(category.userId)에 쓰인다. 없으면 null.
  findByIdWithCategory(milestoneId: number) {
    return prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { category: true },
    });
  },

  // 단건 생성(SINGLE/RANGE). displayOrder는 startDate 기준 위치에 삽입된다(PLB-016).
  create(data: CreateRowInput) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        const [slot] = await reserveDateOrderSlots(tx, data.categoryId, [data.startDate]);
        return tx.milestone.create({ data: { ...data, displayOrder: slot } });
      }, TX_OPTIONS),
    );
  },

  // 다중(MULTIPLE) 생성: 날짜마다 회차 row를 만들고 같은 seriesId로 묶는다(PLB-012).
  // 전체를 한 트랜잭션으로 묶어 일부 회차만 생성되는 상태를 방지한다.
  createMultiple(input: {
    categoryId: number;
    createdByUserId: number;
    name: string;
    dates: Date[];
  }) {
    return withDeadlockRetry(() =>
      prisma.$transaction((tx) => createSeriesRows(tx, input), TX_OPTIONS),
    );
  },

  // 날짜 타입 변경(#84). 수정 대상 row(앵커)를 지우지 않고 그대로 갱신해 milestoneId를 유지한다
  // (태스크 도메인이 taskId를 유지한 채 자식 TaskDate만 교체하는 것과 같은 방식).
  // 앵커가 살아남으므로 그 하위 태스크는 손댈 필요가 없고, 정리되는 형제 회차의 태스크만
  // 앵커로 옮긴다(Milestone→Task가 onDelete: Cascade라 옮기지 않으면 함께 삭제된다).
  // isCompleted는 보존하지만 displayOrder는 새 날짜 기준으로 다시 잡는다.
  // 날짜를 통째로 새로 지정하는 경로이므로 옛 날짜 기준의 자리를 유지하면 목록이
  // D-Day 순과 어긋나고, 특히 MULTIPLE에서는 앵커만 옛 자리에 남고 새 회차는 날짜 순으로
  // 꽂혀 같은 시리즈 안에서 배치 규칙이 갈린다.
  // 반환 배열의 0번은 항상 앵커다.
  // moveToCategoryId가 있으면 같은 트랜잭션 안에서 카테고리 이동까지 끝낸다(#86).
  // 별도 트랜잭션으로 나누면 날짜만 바뀌고 이동은 안 된 상태가 남을 수 있다.
  // seriesId는 기존 시리즈 키다(MULTIPLE이 아니면 null). 정리 대상 회차 목록을 트랜잭션 밖에서
  // 확정하면 그 사이 시리즈 구성이 바뀌었을 때 고아 회차가 남으므로, 조회를 트랜잭션 안에서 한다.
  changeDateType(input: {
    anchorId: number;
    seriesId: number | null;
    categoryId: number;
    name: string;
    dateType: 'SINGLE' | 'RANGE' | 'MULTIPLE';
    startDate: Date | null;
    endDate: Date | null;
    dates: Date[] | null;
    moveToCategoryId?: number;
  }) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        if (input.seriesId !== null) {
          const siblings = await tx.milestone.findMany({
            where: { seriesId: input.seriesId, id: { not: input.anchorId } },
            select: { id: true },
          });
          if (siblings.length > 0) {
            await tx.task.updateMany({
              where: { milestoneId: { in: siblings.map((row) => row.id) } },
              data: { milestoneId: input.anchorId },
            });
          }
          // 삭제는 id 목록이 아니라 seriesId 조건으로 건다. 조회 직후 회차가 늘어나도
          // 함께 정리되어 고아 회차가 남지 않는다(갓 생긴 회차에는 하위 태스크가 없다).
          await tx.milestone.deleteMany({
            where: { seriesId: input.seriesId, id: { not: input.anchorId } },
          });
        }

        // 형제 회차는 위에서 지워져 잠금 대상에 없고, 앵커는 날짜가 바뀌므로 제외해
        // 새 날짜 기준으로 자리를 다시 잡는다. slots[0]이 앵커 몫이다.
        const dates =
          input.dateType === 'MULTIPLE'
            ? [...(input.dates ?? [])].sort((a, b) => a.getTime() - b.getTime())
            : [input.startDate!]; // zod가 SINGLE/RANGE에서 필수 보장
        const slots = await reserveDateOrderSlots(tx, input.categoryId, dates, [
          input.anchorId,
        ]);

        if (input.dateType !== 'MULTIPLE') {
          const updated = await tx.milestone.update({
            where: { id: input.anchorId },
            data: {
              name: input.name,
              dateType: input.dateType,
              startDate: dates[0],
              endDate: input.dateType === 'RANGE' ? input.endDate : null,
              seriesId: null, // MULTIPLE 전용 필드라 벗어나면 비운다
              displayOrder: slots[0],
            },
          });
          return input.moveToCategoryId !== undefined
            ? applyMove(tx, [input.anchorId], input.moveToCategoryId)
            : [updated];
        }

        // MULTIPLE: 앵커가 가장 이른 날짜의 첫 회차가 되고 seriesId로 자기 id를 쓴다
        // (생성 경로의 "seriesId = 첫 회차 id" 규칙과 동일).
        const anchor = await tx.milestone.update({
          where: { id: input.anchorId },
          data: {
            name: input.name,
            dateType: 'MULTIPLE',
            startDate: dates[0],
            endDate: null,
            seriesId: input.anchorId,
            displayOrder: slots[0],
          },
        });

        if (dates.length > 1) {
          await tx.milestone.createMany({
            // 새로 생기는 회차의 작성자는 "수정한 사람"이 아니라 앵커의 작성자를 그대로 쓴다.
            // 날짜 재지정은 같은 마일스톤의 형태를 바꾸는 것이라, 회차마다 작성자가 갈리면
            // 한 시리즈 안에서 표시가 어긋난다. 앵커가 NULL이면(도입 이전 행·탈퇴자) 그대로 NULL이다.
            data: dates.slice(1).map((date, i) => ({
              categoryId: input.categoryId,
              createdByUserId: anchor.createdByUserId,
              name: input.name,
              dateType: 'MULTIPLE' as const,
              startDate: date,
              endDate: null,
              seriesId: input.anchorId,
              displayOrder: slots[i + 1],
            })),
          });
        }

        // 날짜 오름차순이므로 0번은 가장 이른 날짜 = 앵커다.
        const series = await tx.milestone.findMany({
          where: { seriesId: input.anchorId },
          orderBy: { startDate: 'asc' },
        });
        return input.moveToCategoryId !== undefined
          ? applyMove(tx, series.map((row) => row.id), input.moveToCategoryId)
          : series;
      }, TX_OPTIONS),
    );
  },

  update(milestoneId: number, data: Prisma.MilestoneUncheckedUpdateInput) {
    return prisma.milestone.update({ where: { id: milestoneId }, data });
  },

  // 수정 + 시리즈 전파(editScope=ALL, PLB-013): 지정 회차는 전달된 필드 전부를,
  // 같은 seriesId의 "fromDate 이후 + 미완료" 회차에는 이름만 반영한다(완료된 과거 회차 보존).
  updateWithSeriesName(
    milestoneId: number,
    data: Prisma.MilestoneUncheckedUpdateInput,
    series: SeriesNameSpread,
  ) {
    return withDeadlockRetry(() =>
      prisma.$transaction((tx) => applyUpdate(tx, milestoneId, data, series), TX_OPTIONS),
    );
  },

  // 이름·날짜 수정과 카테고리 이동을 한 트랜잭션으로 처리한다(#86).
  // 수정을 먼저 반영해야 바뀐 startDate 기준으로 대상 카테고리의 순번이 잡히고,
  // 이동에서 실패하면 수정까지 함께 롤백되어 "이름만 바뀐" 상태가 남지 않는다.
  //
  // seriesId가 있으면(MULTIPLE) 시리즈 회차 전체가 이동 대상이다. 대상 목록을 트랜잭션 밖에서
  // 확정하면 그 사이 늘어난 회차가 원본 카테고리에 남아 시리즈가 두 카테고리로 흩어지므로,
  // 조회를 트랜잭션 안에서 한다.
  updateWithMove(input: {
    milestoneId: number;
    seriesId: number | null;
    data: Prisma.MilestoneUncheckedUpdateInput;
    series?: SeriesNameSpread; // editScope=ALL일 때만
    targetCategoryId: number;
  }) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        await applyUpdate(tx, input.milestoneId, input.data, input.series);

        const moveIds =
          input.seriesId !== null
            ? (
                await tx.milestone.findMany({
                  where: { seriesId: input.seriesId },
                  select: { id: true },
                })
              ).map((row) => row.id)
            : [input.milestoneId];

        const moved = await applyMove(tx, moveIds, input.targetCategoryId);
        // 이동 후 다시 읽은 row라 방금 반영한 이름·날짜도 함께 담겨 있다.
        return moved.find((row) => row.id === input.milestoneId) ?? moved[0];
      }, TX_OPTIONS),
    );
  },

  // 삭제. 하위 태스크는 함께 지우지 않고 카테고리 직속으로 내보낸 뒤 마일스톤만 삭제한다
  // (프론트 확정 정책). 하위 태스크가 없으면 detach가 아무것도 하지 않으므로 분기가 필요 없다.
  delete(milestoneId: number, categoryId: number) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        await detachTasksToCategory(tx, [milestoneId], categoryId);
        return tx.milestone.delete({ where: { id: milestoneId } });
      }, TX_OPTIONS),
    );
  },

  // 시리즈 삭제(deleteScope=ALL, PLB-014): 지정 회차 + 같은 seriesId의
  // "fromDate 이후 + 미완료" 회차를 일괄 삭제한다(완료된 과거 회차 보존).
  // 단건 삭제와 마찬가지로 정리 대상 회차의 하위 태스크를 먼저 카테고리 직속으로 내보낸다 —
  // 여러 회차를 한 번에 지우므로 여기가 빠지면 정책 구멍이 가장 크게 뚫리는 지점이다.
  //
  // 삭제는 조회해둔 id 목록이 아니라 같은 where 조건으로 다시 건다. 조회 직후 회차가 늘어나도
  // 함께 정리되어 고아 회차가 남지 않는다(갓 생긴 회차에는 하위 태스크가 없어 detach 대상도 아니다).
  // changeDateType이 형제 회차를 정리할 때 쓰는 것과 같은 방식이다.
  deleteWithSeries(
    milestoneId: number,
    seriesId: number,
    fromDate: Date,
    categoryId: number,
  ) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        const where = {
          OR: [
            { id: milestoneId },
            { seriesId, startDate: { gte: fromDate }, isCompleted: false },
          ],
        };

        const targets = await tx.milestone.findMany({ where, select: { id: true } });
        await detachTasksToCategory(
          tx,
          targets.map((row) => row.id),
          categoryId,
        );

        return tx.milestone.deleteMany({ where });
      }, TX_OPTIONS),
    );
  },

  // 순서 일괄 변경(한 트랜잭션). orderedIds 순서대로 displayOrder 0,1,2...
  reorder(orderedIds: number[]) {
    return prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.milestone.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  },

  // 오늘(KST) 알림 배치용(PLB-038). SINGLE·MULTIPLE은 startDate가 곧 그 회차의 날짜라 동일한
  // 조건으로 묶인다. RANGE는 기간에 오늘이 포함되면 매일 알림(이슈 #56, A안 확정)이라
  // startDate~endDate 사이에 오늘이 들어가는지로 판단한다. 소유자(userId)는 category를
  // 통해서만 알 수 있다(2-hop).
  findDueTodayWithOwner(today: Date) {
    return prisma.milestone.findMany({
      where: {
        isCompleted: false,
        OR: [
          { dateType: { in: ['SINGLE', 'MULTIPLE'] }, startDate: today },
          { dateType: 'RANGE', startDate: { lte: today }, endDate: { gte: today } },
        ],
      },
      select: { id: true, category: { select: { userId: true } } },
    });
  },
};