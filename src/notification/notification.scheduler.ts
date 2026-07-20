// 알림 배치 스케줄러 (PLB-038). 서버 프로세스가 상시 구동 중이라는 전제의 인프로세스 cron이다.
// 서버 재시작이 00:00 KST와 겹치면 그날의 cron이 스킵될 수 있는데, generateDailyDueNotifications가
// (userId, type, relatedId, dueDate) 유니크 제약 + skipDuplicates로 멱등하게 동작하므로, 서버
// 기동 시 한 번 즉시 실행해 놓치고 지나간 당일 배치를 곧바로 catch-up한다 — 이미 실행됐던 날이면
// 전부 스킵되어 중복이 생기지 않는다.

import cron from 'node-cron';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';

async function runDailyDueBatch() {
  try {
    await notificationService.generateDailyDueNotifications();
  } catch (err) {
    logger.error(err);
  }
}

export function registerNotificationScheduler() {
  runDailyDueBatch();
  cron.schedule('0 0 * * *', runDailyDueBatch, { timezone: 'Asia/Seoul' });
}
