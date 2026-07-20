// Notification Service
// 비즈니스 로직 계층. 목록/읽음/삭제(선택 필요 알림 보존) 규칙 담당.

import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { getTodayKST } from '../utils/date';
import { notificationRepository } from './notification.repository';
import { milestoneRepository } from '../milestone/milestone.repository';
import { taskRepository } from '../task/task.repository';
import { userRepository } from '../user/user.repository';

const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 최대 30일 보관 (PLB-038)

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

  // 매일 00시(KST) 배치. 당일(SINGLE·MULTIPLE) 마감인 마일스톤·태스크에 대해 MILESTONE_DUE·
  // TASK_DUE 알림을 일괄 생성한다(PLB-038, 이슈 #56). RANGE는 "기간 중 언제 알릴지" 기준이
  // PM 확인 대기 중이라 milestoneRepository/taskRepository 쪽 쿼리에서 이미 제외돼 있다.
  // 완료된 항목은 애초에 저장소 쿼리에서 제외되고, notifyTaskDue를 꺼둔 유저는 여기서 제외한다.
  // (userId, type, relatedId, dueDate) 유니크 제약 + skipDuplicates 덕분에 같은 날 여러 번
  // 호출돼도(서버 재시작 catch-up, QA 수동 트리거 등) 중복 알림이 쌓이지 않는다 — 멱등성 보장.
  async generateDailyDueNotifications() {
    const today = getTodayKST();
    const [dueMilestones, dueSingleTasks, dueMultipleTaskDates] = await Promise.all([
      milestoneRepository.findDueTodayWithOwner(today),
      taskRepository.findSingleDueToday(today),
      taskRepository.findMultipleDueToday(today),
    ]);

    const candidates = [
      ...dueMilestones.map((m) => ({ userId: m.category.userId, type: 'MILESTONE_DUE' as const, relatedId: m.id })),
      ...dueSingleTasks.map((t) => ({ userId: t.userId, type: 'TASK_DUE' as const, relatedId: t.id })),
      ...dueMultipleTaskDates.map((td) => ({
        userId: td.task.userId,
        type: 'TASK_DUE' as const,
        relatedId: td.task.id,
      })),
    ];
    if (candidates.length === 0) return { count: 0 };

    const notifyEnabledIds = await userRepository.findNotifyEnabledIds([
      ...new Set(candidates.map((c) => c.userId)),
    ]);

    const expiresAt = new Date(Date.now() + NOTIFICATION_RETENTION_MS);
    const data: Prisma.NotificationCreateManyInput[] = candidates
      .filter((c) => notifyEnabledIds.has(c.userId))
      .map((c) => ({ userId: c.userId, type: c.type, relatedId: c.relatedId, dueDate: today, expiresAt }));

    return notificationRepository.createMany(data);
  },
};
