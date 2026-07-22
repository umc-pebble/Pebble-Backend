import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { reportService } from './report.service';
import { UpdateReportImageBody } from './report.schema';

// 경로 파라미터가 양의 정수 리포트 ID인지 확인한다.
const parseReportId = (raw: string) => {
  const reportId = Number(raw);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    throw new AppError('COMMON_INVALID_INPUT', '유효하지 않은 리포트 ID입니다.');
  }
  return reportId;
};

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 인증 미들웨어가 해석한 로그인 사용자의 최신 유효 리포트만 반환한다.
    const report = await reportService.getLatestReport(req.userId!);
    sendSuccess(res, report, '리포트 조회 성공');
  } catch (err) {
    next(err);
  }
};

export const updateReportImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reportId = parseReportId(req.params.reportId);
    const { reportImageUrl } = req.body as UpdateReportImageBody;
    const data = await reportService.updateReportImage(req.userId!, reportId, reportImageUrl);
    sendSuccess(res, data, '리포트 이미지 저장 성공');
  } catch (err) {
    next(err);
  }
};