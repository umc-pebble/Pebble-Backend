// 아래 라우터 import들이 모듈 로드 시점에 process.env를 참조하므로(config/supabase.ts 등),
// dotenv 로딩은 다른 import보다 먼저 실행되어야 한다.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/error.middleware';
import { swaggerSpec } from './config/swagger';
import categoryRouter from './category/category.route';
import milestoneRouter from './milestone/milestone.route';
import taskRouter from './task/task.route';
import sharedRouter from './shared/shared.route';
import activityRouter from './activity/activity.route';
import authRouter from './auth/auth.route';
import userRouter from './user/user.route';
import uploadRouter from './upload/upload.route';
import followRouter from './follow/follow.route';
import notificationRouter from './notification/notification.route';
import { registerNotificationScheduler } from './notification/notification.scheduler';
import reportRouter from './report/report.route';
import subscriptionRouter from './subscription/subscription.route';
import { ERROR_CODE } from './constants/error-code';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Pebble API is running' });
});

// Swagger UI (API 문서)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Postman 등 외부 도구가 OpenAPI 스펙을 URL로 임포트/동기화할 수 있도록 raw JSON도 노출한다.
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// 라우터 등록
// 경로가 교차(category/:id/milestones, users/me/settings 등)하므로 모두 /api/v1 에 함께 마운트하고,
// 각 라우트 파일 내부에서 전체 경로(/auth/signup, /users/me 등)를 정의한다.
app.use('/api/v1', categoryRouter);
app.use('/api/v1', milestoneRouter);
app.use('/api/v1', taskRouter);
app.use('/api/v1', sharedRouter);
app.use('/api/v1', activityRouter);
app.use('/api/v1', authRouter);
// followRouter가 고정 경로 /users/search를 정의하므로 userRouter(/users/:userId)보다 먼저 마운트해야 한다
app.use('/api/v1', followRouter);
app.use('/api/v1', userRouter);
app.use('/api/v1', uploadRouter);
app.use('/api/v1', notificationRouter);
app.use('/api/v1', reportRouter);
app.use('/api/v1', subscriptionRouter);

app.use((_req, res) => {
  res.status(ERROR_CODE.COMMON_NOT_FOUND.status).json({
    success: false,
    message: '요청한 리소스를 찾을 수 없습니다.',
    error: { code: ERROR_CODE.COMMON_NOT_FOUND.code },
  });
});

app.use(errorHandler);

registerNotificationScheduler();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
