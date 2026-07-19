// Notification Service
// 비즈니스 로직 계층. 목록/읽음/삭제(선택 필요 알림 보존) 규칙 담당.

import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { notificationRepository } from './notification.repository';

// getOwnedNotificationOrThrow 통과 후에도 update/delete 사이에 다른 요청이 먼저 처리할 수 있으므로,
// 그 경쟁 상황에서 발생하는 P2025(대상 없음)는 COMMON_NOT_FOUND로 변환한다.
function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

// 소유 알림 조회 + 소유권 검증. 없으면 404, 본인 소유가 아니면 403.
async function getOwnedNotificationOrThrow(userId: number, notificationId: number) {
  const notification = await notificationRepository.findById(notificationId);
  if (!notification) {
    throw new AppError('COMMON_NOT_FOUND', '존재하지 않는 알림입니다.');
  }
  if (notification.userId !== userId) {
    throw new AppError('COMMON_FORBIDDEN', '해당 작업에 대한 권한이 없습니다.');
  }
  return notification;
}

// mutation(where에 userId 포함, 원자적)을 먼저 시도한다. 실패했을 때만 조회해서 404(대상 없음)와
// 403(다른 유저 소유)을 구분한다 — 사전 조회 후 mutation을 하면 그 사이 경합(TOCTOU)이 생기기 때문에
// 순서를 뒤집었다. 조회까지 통과했는데도 mutation이 실패했다면 그 찰나의 경합 상황이다.
async function runOwnedMutation<T>(
  userId: number,
  notificationId: number,
  operation: () => Promise<T>,
  failureMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (isRecordNotFound(err)) {
      await getOwnedNotificationOrThrow(userId, notificationId);
      throw new AppError('COMMON_NOT_FOUND', '존재하지 않는 알림입니다.');
    }
    logger.error(err);
    throw new AppError('COMMON_INTERNAL_ERROR', failureMessage);
  }
}

export const notificationService = {
  async getNotifications(userId: number, offset: number, limit: number) {
    const [notifications, { total, unreadCount }] = await Promise.all([
      notificationRepository.findManyByUserId(userId, offset, limit),
      notificationRepository.getCountsByUserId(userId),
    ]);

    return {
      // userId는 응답 계약에 없는 내부 필드라 제외하고 문서화된 필드만 내려준다.
      notifications: notifications.map(({ id, type, relatedId, isRead, expiresAt, createdAt }) => ({
        id,
        type,
        relatedId,
        isRead,
        expiresAt,
        createdAt,
      })),
      unreadCount,
      page: { offset, limit, total },
    };
  },

  async readNotification(userId: number, notificationId: number) {
    const updated = await runOwnedMutation(
      userId,
      notificationId,
      () => notificationRepository.markRead(userId, notificationId),
      '알림 읽음 처리에 실패했습니다.',
    );
    return { id: updated.id, isRead: updated.isRead };
  },

  async deleteNotification(userId: number, notificationId: number) {
    await runOwnedMutation(
      userId,
      notificationId,
      () => notificationRepository.delete(userId, notificationId),
      '알림 삭제에 실패했습니다.',
    );
  },

  async deleteAllNotifications(userId: number) {
    await notificationRepository.deleteAllExceptFollowRequest(userId);
  },
};
