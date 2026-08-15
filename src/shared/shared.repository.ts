import { NotificationType, Prisma, SharedCategoryRole, SharedCategoryStatus } from '@prisma/client';
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
        data: {
          categoryId,
          userId: ownerId,
          role: 'OWNER',
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
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

  // status를 ACCEPTED로 바꿀 때는 acceptedAt도 함께 채운다 — 오너 회원탈퇴 시 후계자
  // (가장 먼저 수락한 멤버) 선정에 실제 수락 순서가 필요하다(createdAt은 초대 생성 시각이라 다르다).
  updateMemberStatus(categoryId: number, userId: number, status: SharedCategoryStatus) {
    return prisma.sharedCategoryMember.update({
      where: { categoryId_userId: { categoryId, userId } },
      data: { status, ...(status === 'ACCEPTED' ? { acceptedAt: new Date() } : {}) },
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

  // 카테고리 생성과 동시에 초대(PLB-044)처럼 이미 userId로 확정된 대상을 검증할 때 쓴다.
  findUserById(userId: number) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  // findUserById의 배치 버전. 초대 대상이 여러 명일 때 한 번의 쿼리로 존재 여부를 확인한다.
  findUsersByIds(userIds: number[]) {
    return prisma.user.findMany({ where: { id: { in: userIds } } });
  },

  // 여러 대상의 기존 멤버십 여부를 한 번에 확인한다(중복 초대 검증용 배치 조회).
  findMemberships(categoryId: number, userIds: number[]) {
    return prisma.sharedCategoryMember.findMany({
      where: { categoryId, userId: { in: userIds } },
      select: { userId: true },
    });
  },

  // 알림은 최대 30일 보관 (PLB-038).
  createNotification(userId: number, type: NotificationType, relatedId: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return prisma.notification.create({ data: { userId, type, relatedId, expiresAt } });
  },

  findAcceptedSharedCategoryIds(userId: number) {
    return prisma.sharedCategoryMember.findMany({
      where: {
        userId,
        status: SharedCategoryStatus.ACCEPTED,
      },
      select: {
        categoryId: true,
      },
    });
  },
  // 자진 탈퇴/강퇴 전용: 멤버십을 삭제하되 마일스톤·태스크·회차는 모두 유지한다.
  // 나가는 멤버가 완료 처리한 항목은 완료 상태와 완료 시각을 보존하고 처리자만 비운다.
  // respondInvite의 초대 거절(REJECT)은 이 메서드를 쓰지 않는다 — PENDING 상태에서는
  // 애초에 태스크를 만들 수 없어 정리할 게 없다(deleteMembership을 그대로 쓴다).
  //
  // completedByUserId가 null이면 남은 공유 멤버 누구나 완료를 해제할 수 있다.
  deleteMembershipAndClearCompletionActor(categoryId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.sharedCategoryMember.delete({ where: { categoryId_userId: { categoryId, userId } } });

      await tx.task.updateMany({
        where: { categoryId, completedByUserId: userId },
        data: { completedByUserId: null },
      });

      await tx.taskDate.updateMany({
        where: { completedByUserId: userId, task: { categoryId } },
        data: { completedByUserId: null },
      });
    });
  },

  // 오너 회원탈퇴 시 후계자 선정: 그 카테고리에서 ACCEPTED 상태이고 탈퇴자 본인이 아닌 멤버 중
  // acceptedAt이 가장 이른(가장 먼저 수락한) 멤버 1명을 반환한다. 없으면 null(후계자 없음 —
  // 호출부는 이관을 건너뛰고 카테고리를 기존처럼 CASCADE로 삭제되게 둔다).
  //
  // tx를 받는다 — 회원탈퇴 트랜잭션 안에서 호출되어야 같은 스냅샷에서 읽는다.
  findEarliestAcceptedMember(tx: Prisma.TransactionClient, categoryId: number, excludeUserId: number) {
    return tx.sharedCategoryMember.findFirst({
      where: { categoryId, status: 'ACCEPTED', userId: { not: excludeUserId } },
      orderBy: [{ acceptedAt: 'asc' }, { id: 'asc' }],
    });
  },

  // 후계자를 새 오너로 승격한다. Category.userId 이관(categoryRepository.transferOwnership)과
  // 같은 트랜잭션에서 호출해야 한다 — 하나만 반영되면 Category 오너와 SharedCategoryMember의
  // OWNER role이 어긋난다. 기존 오너(탈퇴자)의 멤버십 row는 User 삭제 시 CASCADE로 함께
  // 삭제되므로 여기서 따로 지우지 않는다.
  promoteToOwner(tx: Prisma.TransactionClient, categoryId: number, userId: number) {
    return tx.sharedCategoryMember.update({
      where: { categoryId_userId: { categoryId, userId } },
      data: { role: 'OWNER' },
    });
  },
};
