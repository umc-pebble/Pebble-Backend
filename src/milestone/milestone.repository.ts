// Milestone Repository
// DB 접근 계층. Prisma 쿼리만 담당한다. 소유권(2-hop)·범위 규칙은 milestoneService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

// 트랜잭션 클라이언트 타입 (prisma.$transaction 콜백 인자)
type Tx = Prisma.TransactionClient;

interface CreateRowInput {
  categoryId: number;
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
  input: { categoryId: number; name: string; dates: Date[] },
) {
  const sorted = [...input.dates].sort((a, b) => a.getTime() - b.getTime());
  const slots = await reserveDateOrderSlots(tx, input.categoryId, sorted);

  const first = await tx.milestone.create({
    data: {
      categoryId: input.categoryId,
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

export const milestoneRepository = {
  // 카테고리에 속한 마일스톤 목록. 수동 순서(displayOrder) 우선, 같으면 D-Day(startDate) 순.
  findManyByCategoryId(categoryId: number) {
    return prisma.milestone.findMany({
      where: { categoryId },
      orderBy: [{ displayOrder: 'asc' }, { startDate: 'asc' }],
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
  createMultiple(input: { categoryId: number; name: string; dates: Date[] }) {
    return withDeadlockRetry(() =>
      prisma.$transaction((tx) => createSeriesRows(tx, input), TX_OPTIONS),
    );
  },

  // 같은 시리즈(MULTIPLE)에 속한 회차 전체의 id. 날짜 타입 재지정의 교체 대상 범위로 쓰인다.
  async findIdsBySeriesId(seriesId: number) {
    const rows = await prisma.milestone.findMany({
      where: { seriesId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
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
  changeDateType(input: {
    anchorId: number;
    siblingIds: number[]; // 정리할 같은 시리즈의 나머지 회차 (앵커 제외)
    categoryId: number;
    name: string;
    dateType: 'SINGLE' | 'RANGE' | 'MULTIPLE';
    startDate: Date | null;
    endDate: Date | null;
    dates: Date[] | null;
  }) {
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        if (input.siblingIds.length > 0) {
          await tx.task.updateMany({
            where: { milestoneId: { in: input.siblingIds } },
            data: { milestoneId: input.anchorId },
          });
          await tx.milestone.deleteMany({ where: { id: { in: input.siblingIds } } });
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
          return [updated];
        }

        // MULTIPLE: 앵커가 가장 이른 날짜의 첫 회차가 되고 seriesId로 자기 id를 쓴다
        // (생성 경로의 "seriesId = 첫 회차 id" 규칙과 동일).
        await tx.milestone.update({
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
            data: dates.slice(1).map((date, i) => ({
              categoryId: input.categoryId,
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
        return tx.milestone.findMany({
          where: { seriesId: input.anchorId },
          orderBy: { startDate: 'asc' },
        });
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
    series: { seriesId: number; fromDate: Date; name: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data,
      });
      await tx.milestone.updateMany({
        where: {
          seriesId: series.seriesId,
          id: { not: milestoneId },
          startDate: { gte: series.fromDate },
          isCompleted: false,
        },
        data: { name: series.name },
      });
      return updated;
    });
  },

  // 삭제. 하위 task는 스키마 onDelete: Cascade로 함께 삭제된다.
  delete(milestoneId: number) {
    return prisma.milestone.delete({ where: { id: milestoneId } });
  },

  // 시리즈 삭제(deleteScope=ALL, PLB-014): 지정 회차 + 같은 seriesId의
  // "fromDate 이후 + 미완료" 회차를 일괄 삭제한다(완료된 과거 회차 보존).
  deleteWithSeries(milestoneId: number, seriesId: number, fromDate: Date) {
    return prisma.milestone.deleteMany({
      where: {
        OR: [
          { id: milestoneId },
          { seriesId, startDate: { gte: fromDate }, isCompleted: false },
        ],
      },
    });
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