import { NotificationType, SharedCategoryRole, SharedCategoryStatus } from '@prisma/client';
import prisma from '../config/database';

// Shared Category Repository
// DB 접근 계층. Prisma 쿼리만 담당한다. Category/User/Follow/Notification 테이블도
// 필요한 만큼 직접 조회한다 (auth.repository가 User 테이블을 직접 조회하는 것과 동일한 패턴 —
// 각 도메인 repository가 비어있는 스텁 상태라 경계 협의 전까지는 이렇게 둔다).

export const sharedRepository = {
  findCategoryById(categoryId: number) {
    return prisma.category.findUnique({ where: { id: categoryId } });
  },

  // 전환(isShared=true) + 오너 등록 + 초대 대상 등록을 하나의 트랜잭션으로 묶는다.
  // 중간에 실패하면 전부 롤백되어 "카테고리는 공유로 바뀌었는데 멤버가 없는" 상태를 막는다.
  // (auth.repository의 createUserWithRefreshToken과 동일한 패턴)
  //
  // isShared 갱신은 반드시 WHERE isShared=false 조건으로 건다 — service의 사전 체크는
  // 빠른 경로일 뿐이고(레이스 컨디션에 무력함), 이 조건부 UPDATE가 동시 요청에 대한
  // 최후 방어선이다. 조건에 안 맞아 0 row가 갱신되면(이미 누군가 먼저 전환) null을 반환해
  // 호출자(service)가 AppError로 변환하게 한다 — 그대로 진행하면 OWNER row 중복 생성 시도로
  // 유니크 제약(P2002)이 처리되지 않은 채 500으로 떨어진다.
  shareCategoryTransaction(categoryId: number, ownerId: number, inviteeUserIds: number[]) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.category.updateMany({
        where: { id: categoryId, isShared: false },
        data: { isShared: true },
      });
      if (updated.count === 0) {
        return null;
      }
      await tx.sharedCategoryMember.create({
        data: { categoryId, userId: ownerId, role: 'OWNER', status: 'ACCEPTED' },
      });
      if (inviteeUserIds.length > 0) {
        await tx.sharedCategoryMember.createMany({
          data: inviteeUserIds.map((userId) => ({
            categoryId,
            userId,
            role: 'MEMBER' as const,
            status: 'PENDING' as const,
          })),
        });
      }
      return tx.sharedCategoryMember.findMany({
        where: { categoryId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });
    });
  },

  deleteCategory(categoryId: number) {
    return prisma.category.delete({ where: { id: categoryId } });
  },

  findMembership(categoryId: number, userId: number) {
    return prisma.sharedCategoryMember.findUnique({
      where: { categoryId_userId: { categoryId, userId } },
    });
  },

  findMembers(categoryId: number) {
    return prisma.sharedCategoryMember.findMany({
      where: { categoryId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  },

  createMember(
    categoryId: number,
    userId: number,
    role: SharedCategoryRole,
    status: SharedCategoryStatus,
  ) {
    return prisma.sharedCategoryMember.create({ data: { categoryId, userId, role, status } });
  },

  updateMemberStatus(categoryId: number, userId: number, status: SharedCategoryStatus) {
    return prisma.sharedCategoryMember.update({
      where: { categoryId_userId: { categoryId, userId } },
      data: { status },
    });
  },

  deleteMembership(categoryId: number, userId: number) {
    return prisma.sharedCategoryMember.delete({
      where: { categoryId_userId: { categoryId, userId } },
    });
  },

  // 이메일은 완전 일치. 닉네임은 "닉네임#태그"면 정확히 하나를, 태그 없이 닉네임만 주어지면
  // 첫 번째 일치하는 유저를 반환한다(닉네임은 PLB-003에 따라 중복 가능이라 여러 명일 수 있음).
  findUserByNicknameOrEmail(target: { nickname?: string; email?: string }) {
    if (target.email) {
      return prisma.user.findUnique({ where: { email: target.email } });
    }
    const nickname = target.nickname!;
    const hashIndex = nickname.indexOf('#');
    if (hashIndex >= 0) {
      return prisma.user.findUnique({
        where: {
          nickname_uniqueTag: {
            nickname: nickname.slice(0, hashIndex),
            uniqueTag: nickname.slice(hashIndex + 1),
          },
        },
      });
    }
    return prisma.user.findFirst({ where: { nickname } });
  },

  // 알림은 최대 30일 보관 (PLB-038).
  createNotification(userId: number, type: NotificationType, relatedId: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return prisma.notification.create({ data: { userId, type, relatedId, expiresAt } });
  },
};
