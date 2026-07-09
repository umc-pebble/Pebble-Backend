import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

// Activity(징검다리) Controller
// req/res 처리만 담당한다. 실제 로직은 추후 activityService로 위임 예정.
// 라우트/문서 검증용 스텁이며, 공통 응답 포맷 { success, message, data }는 sendSuccess로 반환한다.
export const getActivityByUserId = (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const baseDate = req.query.baseDate as string | undefined;

  sendSuccess(
    res,
    {
      userId,
      nickname: '페블이',
      activityColor: 'GREEN',
      baseDate: baseDate ?? '2026-06-11',
      logs: [
        {
          date: '2026-06-05',
          completedTaskCount: 0,
          level: 0,
        },
        {
          date: '2026-06-06',
          completedTaskCount: 2,
          level: 1,
        },
        {
          date: '2026-06-07',
          completedTaskCount: 4,
          level: 2,
        },
        {
          date: '2026-06-08',
          completedTaskCount: 5,
          level: 3,
        },
        {
          date: '2026-06-09',
          completedTaskCount: 0,
          level: 0,
        },
        {
          date: '2026-06-10',
          completedTaskCount: 0,
          level: 0,
        },
        {
          date: '2026-06-11',
          completedTaskCount: 0,
          level: 0,
        },
      ],
    },
    '요청 성공',
  );
};