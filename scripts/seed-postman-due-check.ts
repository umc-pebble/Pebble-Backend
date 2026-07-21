// Postman 수기 검증용 시드 스크립트 — PLB-038(#56) 배치가 SINGLE·RANGE·MULTIPLE 세 dateType
// 전부에서 오늘(KST) 마감 알림을 정확히 생성하는지 한 번에 확인하기 위한 데이터를 만든다.
// Task/Milestone MULTIPLE은 생성 API가 아직 없어(스텁) DB에 직접 시드한다.
// 실행: npx ts-node scripts/seed-postman-due-check.ts
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import prisma from '../src/config/database';
import { getTodayKST } from '../src/utils/date';

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function cleanup(userId: number) {
  await prisma.milestone.deleteMany({ where: { category: { userId } } });
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
}

async function main() {
  const today = getTodayKST();

  const user = await prisma.user.upsert({
    where: { email: 'postman-due-check@pebble.com' },
    update: {},
    create: { email: 'postman-due-check@pebble.com', password: null, nickname: 'Postman검증', uniqueTag: '9998' },
  });

  await cleanup(user.id);

  const category = await prisma.category.create({
    data: { userId: user.id, name: 'POSTMAN_DUE_CHECK', color: '#FFFFFF' },
  });

  const milestoneSingle = await prisma.milestone.create({
    data: { categoryId: category.id, name: 'POSTMAN_milestone_SINGLE', dateType: 'SINGLE', startDate: today },
  });
  const milestoneRange = await prisma.milestone.create({
    data: {
      categoryId: category.id,
      name: 'POSTMAN_milestone_RANGE',
      dateType: 'RANGE',
      startDate: addDays(today, -1),
      endDate: addDays(today, 1),
    },
  });
  const milestoneMultiple = await prisma.milestone.create({
    data: {
      categoryId: category.id,
      name: 'POSTMAN_milestone_MULTIPLE',
      dateType: 'MULTIPLE',
      startDate: today,
      seriesId: 90001,
    },
  });

  const taskSingle = await prisma.task.create({
    data: { userId: user.id, name: 'POSTMAN_task_SINGLE', dateType: 'SINGLE', startDate: today },
  });
  const taskRange = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'POSTMAN_task_RANGE',
      dateType: 'RANGE',
      startDate: addDays(today, -1),
      endDate: addDays(today, 1),
    },
  });
  const taskMultiple = await prisma.task.create({
    data: { userId: user.id, name: 'POSTMAN_task_MULTIPLE', dateType: 'MULTIPLE' },
  });
  await prisma.taskDate.create({ data: { taskId: taskMultiple.id, date: today } });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const port = process.env.PORT || 3000;

  console.log('=== 시드 완료 ===');
  console.log(`today(KST) = ${today.toISOString().slice(0, 10)}`);
  console.log(`userId = ${user.id}`);
  console.log(`accessToken = ${token}`);
  console.log('\n생성된 항목 (기대: 아래 6건 전부 알림 생성돼야 함)');
  console.table([
    { type: 'MILESTONE_DUE', dateType: 'SINGLE', relatedId: milestoneSingle.id },
    { type: 'MILESTONE_DUE', dateType: 'RANGE', relatedId: milestoneRange.id },
    { type: 'MILESTONE_DUE', dateType: 'MULTIPLE', relatedId: milestoneMultiple.id },
    { type: 'TASK_DUE', dateType: 'SINGLE', relatedId: taskSingle.id },
    { type: 'TASK_DUE', dateType: 'RANGE', relatedId: taskRange.id },
    { type: 'TASK_DUE', dateType: 'MULTIPLE', relatedId: taskMultiple.id },
  ]);

  console.log('\n=== Postman 확인 순서 ===');
  console.log(`1) POST http://localhost:${port}/api/v1/notifications/internal/generate-daily-due`);
  console.log(`   Header: Authorization: Bearer ${token}`);
  console.log(`2) GET  http://localhost:${port}/api/v1/notifications`);
  console.log(`   Header: Authorization: Bearer ${token}`);
  console.log('   -> notifications 배열에 위 표의 6건이 (type, relatedId) 기준으로 전부 있어야 통과');
  console.log('\n정리하려면: npx ts-node -e "import(\'./scripts/seed-postman-due-check.ts\')" 대신 아래 cleanup만 다시 실행');
  console.log(`   DELETE FROM Notification WHERE userId=${user.id}; 등 (또는 이 스크립트 재실행 시 자동 재시딩됨)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
