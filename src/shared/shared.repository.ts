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

  setCategoryShared(categoryId: number, isShared: boolean) {
    return prisma.category.update({ where: { id: categoryId }, data: { isShared } });
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

  createMembersMany(
    entries: {
      categoryId: number;
      userId: number;
      role: SharedCategoryRole;
      status: SharedCategoryStatus;
    }[],
  ) {
    return prisma.sharedCategoryMember.createMany({ data: entries });
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

  // 두 유저가 서로 수락된(ACCEPTED) 팔로우 관계인지 확인한다.
  // Follow는 한 row가 양방향 관계를 표현하므로 방향 상관없이 하나만 찾으면 된다 (PLB-041).
  async isFriend(userIdA: number, userIdB: number) {
    const found = await prisma.follow.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { followerId: userIdA, followingId: userIdB },
          { followerId: userIdB, followingId: userIdA },
        ],
      },
      select: { id: true },
    });
    return found !== null;
  },

  // 알림은 최대 30일 보관 (PLB-038).
  createNotification(userId: number, type: NotificationType, relatedId: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return prisma.notification.create({ data: { userId, type, relatedId, expiresAt } });
  },
};
