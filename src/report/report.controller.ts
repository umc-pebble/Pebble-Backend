import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Report Controller
// req/res 처리만 담당한다. 실제 로직은 추후 reportService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.

export const getReports = (_req: Request, res: Response) => {
  sendSuccess(res, { reports: [] }, '리포트 목록 조회 (미구현)');
};

export const getReportByMonth = (_req: Request, res: Response) => {
  sendSuccess(res, null, '월별 리포트 조회 (미구현)');
};