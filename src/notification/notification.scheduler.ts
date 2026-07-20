// 알림 배치 스케줄러 (PLB-038). 서버 프로세스가 상시 구동 중이라는 전제의 인프로세스 cron이다.
// 서버가 재시작되는 순간과 겹치면 그날의 배치가 스킵될 수 있는 한계는 있지만, 현재 배포 방식(단일
// 상시 프로세스)에서는 별도 인프라 없이 가장 단순하게 PLB-038 요구사항(매일 00시 KST)을 만족한다.

import cron from 'node-cron';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';

export function registerNotificationScheduler() {
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await notificationService.generateDailyDueNotifications();
      } catch (err) {
        logger.error(err);
      }
    },
    { timezone: 'Asia/Seoul' },
  );
}
