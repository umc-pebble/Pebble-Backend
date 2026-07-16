// Notification Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
// 소유권 판정·삭제 예외(FOLLOW_REQUEST) 등 도메인 규칙은 notificationService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

// 30일 경과(만료) 알림은 목록·카운트에서 제외한다(PLB-038). expiresAt이 없는 알림은 항상 포함.
function activeWhere(userId: number): Prisma.NotificationWhereInput {
  return {
    userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
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

  countByUserId(userId: number) {
    return prisma.notification.count({ where: activeWhere(userId) });
  },

  countUnreadByUserId(userId: number) {
    return prisma.notification.count({ where: { ...activeWhere(userId), isRead: false } });
  },

  findById(notificationId: number) {
    return prisma.notification.findUnique({ where: { id: notificationId } });
  },

  markRead(notificationId: number) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  delete(notificationId: number) {
    return prisma.notification.delete({ where: { id: notificationId } });
  },

  // 전체 삭제. FOLLOW_REQUEST는 수락/거절 선택이 필요해 삭제 대상에서 제외한다(PLB-030).
  deleteAllExceptFollowRequest(userId: number) {
    return prisma.notification.deleteMany({
      where: { userId, type: { not: 'FOLLOW_REQUEST' } },
    });
  },
};
