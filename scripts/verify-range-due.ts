// 일회성 검증 스크립트 — 이슈 #56 RANGE(A안) 쿼리 로직(findDueTodayWithOwner의 RANGE 분기,
// taskRepository.findRangeDueToday)이 경계값에서 정확히 동작하는지 실제 DB로 확인한다.
// 실행: npx ts-node scripts/verify-range-due.ts
import 'dotenv/config';
import prisma from '../src/config/database';
import { milestoneRepository } from '../src/milestone/milestone.repository';
import { taskRepository } from '../src/task/task.repository';
import { getTodayKST } from '../src/utils/date';

const TAG = 'RANGE_TEST_';

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function cleanup(userId: number) {
  await prisma.milestone.deleteMany({ where: { category: { userId } } });
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
}

async function main() {
  const today = getTodayKST();

  const user = await prisma.user.upsert({
    where: { email: 'range-test@pebble.com' },
    update: {},
    create: { email: 'range-test@pebble.com', password: null, nickname: 'RANGE테스트', uniqueTag: '9999' },
  });

  await cleanup(user.id);

  const category = await prisma.category.create({
    data: { userId: user.id, name: `${TAG}category`, color: '#FFFFFF' },
  });

  // 케이스: [startOffset, endOffset, isCompleted, 기대결과]
  const cases: { name: string; start: number; end: number; completed: boolean; expectMatch: boolean }[] = [
    { name: '기간 이전(안 겹침)', start: -5, end: -2, completed: false, expectMatch: false },
    { name: '시작일=오늘(경계)', start: 0, end: 3, completed: false, expectMatch: true },
    { name: '마감일=오늘(경계)', start: -3, end: 0, completed: false, expectMatch: true },
    { name: '기간 중간에 오늘 포함', start: -2, end: 2, completed: false, expectMatch: true },
    { name: '기간 이후(안 겹침)', start: 2, end: 5, completed: false, expectMatch: false },
    { name: '기간에 포함되지만 완료 처리됨', start: -1, end: 1, completed: true, expectMatch: false },
  ];

  const milestoneIds: Record<string, number> = {};
  const taskIds: Record<string, number> = {};

  for (const c of cases) {
    const m = await prisma.milestone.create({
      data: {
        categoryId: category.id,
        name: `${TAG}${c.name}`,
        dateType: 'RANGE',
        startDate: addDays(today, c.start),
        endDate: addDays(today, c.end),
        isCompleted: c.completed,
      },
    });
    milestoneIds[c.name] = m.id;

    const t = await prisma.task.create({
      data: {
        userId: user.id,
        name: `${TAG}${c.name}`,
        dateType: 'RANGE',
        startDate: addDays(today, c.start),
        endDate: addDays(today, c.end),
        isCompleted: c.completed,
      },
    });
    taskIds[c.name] = t.id;
  }

  const dueMilestones = await milestoneRepository.findDueTodayWithOwner(today);
  const dueTasks = await taskRepository.findRangeDueToday(today);
  const dueMilestoneIds = new Set(dueMilestones.map((m) => m.id));
  const dueTaskIds = new Set(dueTasks.map((t) => t.id));

  console.log(`today(KST) = ${today.toISOString().slice(0, 10)}`);
  console.log('--- Milestone ---');
  let allPass = true;
  for (const c of cases) {
    const got = dueMilestoneIds.has(milestoneIds[c.name]);
    const pass = got === c.expectMatch;
    allPass &&= pass;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.name}: expect=${c.expectMatch} got=${got}`);
  }
  console.log('--- Task ---');
  for (const c of cases) {
    const got = dueTaskIds.has(taskIds[c.name]);
    const pass = got === c.expectMatch;
    allPass &&= pass;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.name}: expect=${c.expectMatch} got=${got}`);
  }

  await cleanup(user.id);
  console.log(allPass ? '\n=== ALL PASS ===' : '\n=== SOME FAILED ===');
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
