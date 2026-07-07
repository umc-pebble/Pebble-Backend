import { Request, Response } from 'express';

// Report Controller
// req/res 처리만 담당한다. 실제 로직은 추후 reportService로 위임 예정.
// 현재는 라우트/문서 검증용 스텁이며 공통 응답 포맷 { code, message, data }를 따른다.

export const getReports = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '리포트 목록 조회 (미구현)', data: { reports: [] } });
};

export const getReportByMonth = (_req: Request, res: Response) => {
  res.status(200).json({ code: 200, message: '월별 리포트 조회 (미구현)', data: null });
};
