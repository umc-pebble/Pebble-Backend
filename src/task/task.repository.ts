// Task Repository
// DB 접근 계층. Prisma 쿼리만 담당한다.
// TODO: Prisma 스키마(Task / TaskException) 확정 후 실제 CRUD 쿼리 구현 (담당: 하갱/김하경).
// findSingleDueToday·findMultipleDueToday는 PLB-038 알림 배치용으로 이 스키마를 읽기만 하는
// 쿼리라 우선 추가해둔다 — 태스크 CRUD 자체의 구현과는 무관하다.

import prisma from '../config/database';

export const taskRepository = {
  // 오늘(KST) 알림 배치용(PLB-038). SINGLE은 startDate가 곧 그 날짜다. RANGE는 "기간 중 언제
  // 알릴지" 기준이 PM 확인 대기 중이라 이 쿼리에서 제외한다(이슈 #56).
  findSingleDueToday(today: Date) {
    return prisma.task.findMany({
      where: { dateType: 'SINGLE', startDate: today, isCompleted: false },
      select: { id: true, userId: true },
    });
  },

  // MULTIPLE 태스크는 본체(Task)에 날짜가 없고 회차마다 TaskDate 자식 row로 관리되므로,
  // 오늘 날짜에 해당하는 TaskDate가 있는지로 판단한다. relatedId는 TaskDate가 아니라 상위
  // Task.id를 쓴다 — FE가 dateType과 무관하게 항상 "태스크" 하나로 이동할 수 있도록 하기 위함.
  // 회차(TaskDate.isCompleted)뿐 아니라 부모 Task.isCompleted도 함께 확인한다 — 둘 중 하나라도
  // 완료 처리됐다면 알림 대상에서 제외해야 하기 때문이다.
  findMultipleDueToday(today: Date) {
    return prisma.taskDate.findMany({
      where: { date: today, isCompleted: false, task: { dateType: 'MULTIPLE', isCompleted: false } },
      select: { task: { select: { id: true, userId: true } } },
    });
  },
};
