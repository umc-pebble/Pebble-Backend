// Milestone Repository
// DB 접근 계층. Prisma 쿼리만 담당한다. 소유권(2-hop)·범위 규칙은 milestoneService가 담당한다.
// 참고: MULTI(seriesId 회차) 관련 쿼리는 스키마 확정 후 추가 예정. 현재는 SINGLE/RANGE만 사용한다.

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

  // 카테고리 내 마일스톤 개수. 생성 시 displayOrder(맨 뒤) 계산용.
  countByCategoryId(categoryId: number) {
    return prisma.milestone.count({ where: { categoryId } });
  },

  create(data: Prisma.MilestoneUncheckedCreateInput) {
    return prisma.milestone.create({ data });
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
};