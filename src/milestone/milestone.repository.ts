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

// FOR UPDATE 잠금 경합에서 갭 락 교착(deadlock)이 가능해 짧은 재시도를 둔다.
async function withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const isDeadlock =
        (e as { code?: string }).code === 'P2034' || /deadlock/i.test(message);
      if (!isDeadlock || attempt >= 3) throw e;
    }
  }
}

// 기본 정렬 "D-Day 가까운 순"(PLB-016)을 채번 시점에 보장한다:
// 카테고리의 마일스톤을 displayOrder 순으로 잠근 뒤(FOR UPDATE, 동시 생성 직렬화),
// 새 startDate보다 늦은 첫 행 앞에 끼워 넣는다(그 행부터 순번 +1로 밀기).
// 더 늦은 행이 없으면 맨 뒤에 붙인다. 사용자가 드래그로 바꾼 순서는 그대로 존중되고,
// 손대지 않은 목록은 자연히 날짜 오름차순이 된다.
async function insertAtDateOrder(tx: Tx, data: CreateRowInput) {
  const rows = await tx.$queryRaw<
    { id: number; displayOrder: number; startDate: Date }[]
  >`SELECT id, displayOrder, startDate FROM Milestone
    WHERE categoryId = ${data.categoryId}
    ORDER BY displayOrder ASC FOR UPDATE`;

  const newTime = data.startDate.getTime();
  const firstLater = rows.find((r) => r.startDate.getTime() > newTime);

  let position: number;
  if (firstLater) {
    position = firstLater.displayOrder;
    await tx.milestone.updateMany({
      where: { categoryId: data.categoryId, displayOrder: { gte: position } },
      data: { displayOrder: { increment: 1 } },
    });
  } else {
    position = (rows[rows.length - 1]?.displayOrder ?? -1) + 1;
  }

  return tx.milestone.create({ data: { ...data, displayOrder: position } });
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
      prisma.$transaction((tx) => insertAtDateOrder(tx, data)),
    );
  },

  // 다중(MULTIPLE) 생성: 날짜마다 회차 row를 만들고 같은 seriesId로 묶는다(PLB-012).
  // seriesId는 별도 시퀀스 없이 "첫 회차의 id"를 재사용한다.
  // 전체를 한 트랜잭션으로 묶어 일부 회차만 생성되는 상태를 방지한다.
  createMultiple(input: { categoryId: number; name: string; dates: Date[] }) {
    const sorted = [...input.dates].sort((a, b) => a.getTime() - b.getTime());
    return withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        const first = await insertAtDateOrder(tx, {
          categoryId: input.categoryId,
          name: input.name,
          dateType: 'MULTIPLE',
          startDate: sorted[0],
          endDate: null,
          seriesId: null,
        });
        const seriesId = first.id;
        const created = [
          await tx.milestone.update({
            where: { id: first.id },
            data: { seriesId },
          }),
        ];
        for (const date of sorted.slice(1)) {
          created.push(
            await insertAtDateOrder(tx, {
              categoryId: input.categoryId,
              name: input.name,
              dateType: 'MULTIPLE',
              startDate: date,
              endDate: null,
              seriesId,
            }),
          );
        }
        return created;
      }),
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
};