import cron from 'node-cron';
import { reportService } from './report.service';

// 월간 리포트 생성 스케줄러.
// 서버가 실행 중인 상태에서 매월 1일 00:00(KST)에
// 지난달 리포트를 생성한다.
// cron 콜백과 수동 검증 스크립트가 같은 배치 진입점을 사용한다.
export async function runMonthlyReportBatch() {
  try {
    await reportService.createPreviousMonthReports();
  } catch (error) {
    process.stderr.write(
      `Failed to create monthly reports: ${String(error)}\n`,
    );
  }
}

export function startReportScheduler() {
  // 서버가 1일 00:00 직후 재시작한 경우를 대비해
  // 기동 시 한 번 즉시 실행한다.
  // (createPreviousMonthReports가 멱등하게 구현되어 있다면
  // 이미 생성된 리포트는 중복 생성되지 않는다.)
  runMonthlyReportBatch();

  // 매월 1일 00:00(KST)에 리포트 생성
  cron.schedule('0 0 1 * *', runMonthlyReportBatch, {
    timezone: 'Asia/Seoul',
  });
}
