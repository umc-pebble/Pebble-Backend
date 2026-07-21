import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { reportService } from './report.service';

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 인증 미들웨어가 해석한 로그인 사용자의 최신 유효 리포트만 반환한다.
    const report = await reportService.getLatestReport(req.userId!);
    sendSuccess(res, report, '리포트 조회 성공');
  } catch (err) {
    next(err);
  }
};