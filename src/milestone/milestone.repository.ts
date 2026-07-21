// Milestone Repository
// DB 접근 계층. Prisma 쿼리만 담당한다. 소유권(2-hop)·범위 규칙은 milestoneService가 담당한다.
// 참고: MULTIPLE(seriesId 회차) 관련 쿼리는 seriesId 채번 방식 확정 후 추가 예정. 현재는 SINGLE/RANGE만 사용한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

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

  // 생성. displayOrder는 "현재 최대값 + 1"로 목록 맨 뒤에 붙인다.
  // 일반 SELECT는 잠금이 없어 동시 생성 시 같은 max를 읽을 수 있으므로(TOCTOU),
  // FOR UPDATE로 해당 카테고리의 최대 순번 행을 잠가 채번을 직렬화한다.
  // 잠글 행이 없는 첫 생성 등에서 갭 락 교착(deadlock)이 가능해 짧은 재시도를 둔다.
  async create(data: Omit<Prisma.MilestoneUncheckedCreateInput, 'displayOrder'>) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ displayOrder: number }[]>`
            SELECT displayOrder FROM Milestone WHERE categoryId = ${data.categoryId}
            ORDER BY displayOrder DESC LIMIT 1 FOR UPDATE`;
          const next = (rows[0]?.displayOrder ?? -1) + 1;
          return tx.milestone.create({ data: { ...data, displayOrder: next } });
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        const isDeadlock =
          (e as { code?: string }).code === 'P2034' || /deadlock/i.test(message);
        if (!isDeadlock || attempt >= 3) throw e;
      }
    }
  },

  update(milestoneId: number, data: Prisma.MilestoneUncheckedUpdateInput) {
    return prisma.milestone.update({ where: { id: milestoneId }, data });
  },

  // 삭제. 하위 task는 스키마 onDelete: Cascade로 함께 삭제된다.
  delete(milestoneId: number) {
    return prisma.milestone.delete({ where: { id: milestoneId } });
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