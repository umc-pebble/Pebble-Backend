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

  // 자진 탈퇴/강퇴 전용: 멤버십 삭제 + 그 유저가 이 카테고리에 만든 미완료 태스크 삭제를
  // 하나의 트랜잭션으로 묶는다(완료 태스크·마일스톤은 프론트 확정 정책상 그대로 유지).
  // respondInvite의 초대 거절(REJECT)은 이 메서드를 쓰지 않는다 — PENDING 상태에서는
  // 애초에 태스크를 만들 수 없어 정리할 게 없다(deleteMembership을 그대로 쓴다).
  //
  // SINGLE/RANGE와 MULTIPLE을 다르게 처리한다(하경님 확인) — MULTIPLE의 Task.isCompleted는
  // "전 회차가 끝나야 true"인 파생값이라, 회차 일부만 완료된 MULTIPLE 태스크는 Task 기준으로
  // 지우면 이미 완료된 회차(TaskDate)까지 통째로 날아가 "완료는 유지" 정책을 어긴다.
  // - SINGLE/RANGE: Task.isCompleted가 곧 완료 여부라 Task 단위로 미완료면 삭제한다
  //   (TaskDate가 없는 타입이라 CASCADE 걱정 없음).
  // - MULTIPLE: TaskDate.isCompleted 기준으로 미완료 회차만 지운다(완료 회차는 보존).
  //   그 결과 회차가 하나도 안 남은 MULTIPLE 태스크는 빈 부모 row로 고아가 되므로 함께 지운다.
  //
  // Task 테이블을 직접 건드리는 건 이 파일의 기존 관례(Category/User/Follow 등 필요한 만큼
  // 직접 조회)를 그대로 따른 것이다. 원래는 task 도메인 쪽에 위임하는 게 더 일관되지만
  // (findAcceptedSharedCategoryIds를 반대로 task.service.ts가 이 파일에서 가져다 쓰는 것처럼),
  // 정책이 급하게 확정돼 우선 여기 넣었다 — 하경님 편하실 때 task 도메인으로 옮겨도 된다.
  deleteMembershipAndIncompleteTasks(categoryId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.sharedCategoryMember.delete({ where: { categoryId_userId: { categoryId, userId } } });

      await tx.task.deleteMany({
        where: { categoryId, userId, isCompleted: false, dateType: { in: ['SINGLE', 'RANGE'] } },
      });

      await tx.taskDate.deleteMany({
        where: { isCompleted: false, task: { categoryId, userId, dateType: 'MULTIPLE' } },
      });

      const orphanedMultipleTasks = await tx.task.findMany({
        where: { categoryId, userId, dateType: 'MULTIPLE', taskDates: { none: {} } },
        select: { id: true },
      });
      if (orphanedMultipleTasks.length > 0) {
        await tx.task.deleteMany({ where: { id: { in: orphanedMultipleTasks.map((t) => t.id) } } });
      }
    });
  },
};
