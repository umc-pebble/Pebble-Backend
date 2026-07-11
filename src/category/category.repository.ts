// Category Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
// 소유권 판정·개수 제한 등 도메인 규칙은 categoryService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export const categoryRepository = {
  // 특정 유저의 카테고리 목록. displayOrder 오름차순 = 화면에 보이는 순서.
  findManyByUserId(userId: number) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { displayOrder: 'asc' },
    });
  },

  // id로 단건 조회. 없으면 null. "내 것 맞나"(소유권)는 서비스에서 userId를 비교해 판정한다.
  findById(categoryId: number) {
    return prisma.category.findUnique({
      where: { id: categoryId },
    });
  },

  // 유저의 카테고리 개수. 생성 개수 제한(CATEGORY_LIMIT_EXCEEDED) 검사에 사용.
  countByUserId(userId: number) {
    return prisma.category.count({ where: { userId } });
  },

  // 생성. userId·displayOrder 등은 서비스에서 채워 넘긴다.
  // Unchecked 타입: 관계 대신 userId(FK 스칼라)를 직접 넣기 위함.
  create(data: Prisma.CategoryUncheckedCreateInput) {
    return prisma.category.create({ data });
  },

  // 부분 수정. 전달된 필드만 갱신된다(undefined인 필드는 건드리지 않음).
  update(categoryId: number, data: Prisma.CategoryUncheckedUpdateInput) {
    return prisma.category.update({
      where: { id: categoryId },
      data,
    });
  },

  // 삭제. 하위 milestone/task/SharedCategoryMember는 스키마 onDelete: Cascade로 함께 삭제된다.
  delete(categoryId: number) {
    return prisma.category.delete({
      where: { id: categoryId },
    });
  },

  // 순서 일괄 변경. orderedIds에 나열된 순서대로 displayOrder를 0,1,2...로 부여한다.
  // 여러 row 갱신을 한 트랜잭션으로 묶어, 일부만 반영되는 상태를 방지한다.
  reorder(orderedIds: number[]) {
    return prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  },
};