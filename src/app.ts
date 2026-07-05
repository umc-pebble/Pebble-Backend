import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error.middleware';
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

// 라우터 등록
// app.use('/api/v1/auth', authRouter);
// app.use('/api/v1/users', userRouter);
// app.use('/api/v1/categories', categoryRouter);
// app.use('/api/v1/milestones', milestoneRouter);
// app.use('/api/v1/tasks', taskRouter);
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
