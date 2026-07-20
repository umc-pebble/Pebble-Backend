import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { reportService } from './report.service';

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await reportService.getReports(req.userId!);
    sendSuccess(res, { reports }, '리포트 조회 성공');
  } catch (err) {
    next(err);
  }
};