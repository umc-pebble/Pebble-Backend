import cron from 'node-cron';
import { reportService } from './report.service';
import { reportRepository } from './report.repository'
import { NotificationType } from '@prisma/client';

// 월간 리포트 생성 스케줄러.
// 서버가 실행 중인 상태에서 매월 1일 00:00(KST)에
// 지난달 리포트를 생성한다.
// cron 콜백과 수동 검증 스크립트가 같은 배치 진입점을 사용한다.
export async function runMonthlyReportBatch() {
  try {
    const reports = await reportService.createPreviousMonthReports();

    await Promise.all(
      reports.map((report) =>
        reportRepository.createNotification(
          report.userId,
          NotificationType.REPORT,
          report.id,
        ),
      ),
    );
  } catch (error) {
    process.stderr.write(
      `Failed to create monthly reports: ${String(error)}\n`,
    );
  }
}