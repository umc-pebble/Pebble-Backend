// Notification Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
// 소유권 판정·삭제 예외(FOLLOW_REQUEST) 등 도메인 규칙은 notificationService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

// 30일 경과(만료) 알림은 목록·카운트·단건 조회 모두에서 제외한다(PLB-038). expiresAt이 없는 알림은 항상 포함.
function notExpiredWhere(): Prisma.NotificationWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

function activeWhere(userId: number): Prisma.NotificationWhereInput {
  return { userId, ...notExpiredWhere() };
}

export const notificationRepository = {
  findManyByUserId(userId: number, offset: number, limit: number) {
    return prisma.notification.findMany({
      where: activeWhere(userId),
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  },

  // total/unreadCount를 한 번의 groupBy로 함께 구해 count 쿼리 두 번을 한 번으로 줄인다.
  async getCountsByUserId(userId: number) {
    const rows = await prisma.notification.groupBy({
      by: ['isRead'],
      where: activeWhere(userId),
      _count: { _all: true },
    });
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const unreadCount = rows.find((row) => !row.isRead)?._count._all ?? 0;
    return { total, unreadCount };
  },

  // 만료된 알림은 목록에서 빠지는 것과 동일하게 단건 조회(읽음/삭제의 기반)에서도 "존재하지 않음"으로 취급한다.
  // userId는 넘기지 않는다 — 다른 유저 소유 알림과 만료된 알림을 구분해야 403/404를 올바르게 나눌 수 있다.
  findById(notificationId: number) {
    return prisma.notification.findFirst({
      where: { id: notificationId, ...notExpiredWhere() },
    });
  },

  // userId를 조건에 포함해 소유권 검증과 변경을 원자적으로 처리한다.
  markRead(userId: number, notificationId: number) {
    return prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  },

  delete(userId: number, notificationId: number) {
    return prisma.notification.delete({ where: { id: notificationId, userId } });
  },

  // 전체 삭제. FOLLOW_REQUEST는 수락/거절 선택이 필요해 삭제 대상에서 제외한다(PLB-030).
  deleteAllExceptFollowRequest(userId: number) {
    return prisma.notification.deleteMany({
      where: { userId, type: { not: 'FOLLOW_REQUEST' } },
    });
  },

  // 일괄 생성 (PLB-038 당일 마감 알림 배치 등에서 사용). skipDuplicates로 (userId, type,
  // relatedId, dueDate) 유니크 제약과 충돌하는 행은 조용히 건너뛴다 — 배치 재실행(재시작 후
  // catch-up, cron 중복 실행 등)으로 같은 날짜의 알림이 중복 생성되는 것을 막기 위함이다.
  createMany(data: Prisma.NotificationCreateManyInput[]) {
    if (data.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({ data, skipDuplicates: true });
  },
};
