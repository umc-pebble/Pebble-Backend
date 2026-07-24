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

  // 친구 프로필 조회(PLB-040·#64)용 공개 카테고리 목록. 남의 것이라도 isPublic=true만 노출한다.
  // 정렬은 본인 목록과 동일하게 displayOrder(화면 순서) 오름차순.
  findPublicManyByUserId(userId: number) {
    return prisma.category.findMany({
      where: { userId, isPublic: true },
      orderBy: { displayOrder: 'asc' },
    });
  },

  // 유저 존재 확인용(친구 프로필 조회). 없으면 null → 서비스에서 404 판정.
  findUserById(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
  },

  // id로 단건 조회. 없으면 null. "내 것 맞나"(소유권)는 서비스에서 userId를 비교해 판정한다.
  findById(categoryId: number) {
    return prisma.category.findUnique({
      where: { id: categoryId },
    });
  },

  // 생성. displayOrder는 "현재 최대값 + 1"로 목록 맨 뒤에 붙인다.
  // 일반 SELECT는 잠금이 없어 동시 생성 시 같은 max를 읽을 수 있으므로(TOCTOU),
  // FOR UPDATE로 해당 유저의 최대 순번 행을 잠가 채번을 직렬화한다.
  // 잠글 행이 없는 첫 생성 등에서 갭 락 교착(deadlock)이 가능해 짧은 재시도를 둔다.
  // Unchecked 타입: 관계 대신 userId(FK 스칼라)를 직접 넣기 위함.
  async create(data: Omit<Prisma.CategoryUncheckedCreateInput, 'displayOrder'>) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ displayOrder: number }[]>`
            SELECT displayOrder FROM Category WHERE userId = ${data.userId}
            ORDER BY displayOrder DESC LIMIT 1 FOR UPDATE`;
          const next = (rows[0]?.displayOrder ?? -1) + 1;
          return tx.category.create({ data: { ...data, displayOrder: next } });
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        const isDeadlock =
          (e as { code?: string }).code === 'P2034' || /deadlock/i.test(message);
        if (!isDeadlock || attempt >= 3) throw e;
      }
    }
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