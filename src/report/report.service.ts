// Report Service
// 비즈니스 로직 계층. 리포트 목록/월별 조회(만료 판정) 규칙 담당.
// 월별 집계·이미지 생성은 스케줄러에서 처리하며 여기서는 조회만 다룬다.
// TODO: reportRepository를 사용해 실제 로직 구현.

import { reportRepository } from './report.repository';

export const reportService = {
    async getReports(userId: number) {
        const reports = await reportRepository.findAvailableByUserId(userId, new Date());
        return reports.length > 0 ? reports : null;
    },
};
