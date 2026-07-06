import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/error.middleware';
import { swaggerSpec } from './config/swagger';
import categoryRouter from './category/category.route';
import milestoneRouter from './milestone/milestone.route';
import taskRouter from './task/task.route';
import sharedRouter from './shared/shared.route';
import activityRouter from './activity/activity.route';
import { ERROR_CODE } from './constants/error-code';

dotenv.config();

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

// 라우터 등록
// 담당 도메인 4개는 경로가 교차(category/:id/milestones 등)하므로 /api/v1 에 함께 마운트하고,
// 각 라우트 파일 내부에서 전체 경로를 정의한다.
app.use('/api/v1', categoryRouter);
app.use('/api/v1', milestoneRouter);
app.use('/api/v1', taskRouter);
app.use('/api/v1', sharedRouter);
app.use('/api/v1', activityRouter);
// app.use('/api/v1/auth', authRouter);
// app.use('/api/v1/users', userRouter);
// app.use('/api/v1/follows', followRouter);
// app.use('/api/v1/notifications', notificationRouter);
// app.use('/api/v1/reports', reportRouter);

app.use((_req, res) => {
  res.status(ERROR_CODE.COMMON_NOT_FOUND.status).json({
    success: false,
    message: '요청한 리소스를 찾을 수 없습니다.',
    error: { code: ERROR_CODE.COMMON_NOT_FOUND.code },
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
