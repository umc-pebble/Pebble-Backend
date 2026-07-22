import prisma from '../config/database';

export const reportRepository = {
  // 소유권 검증을 위해 리포트의 사용자 ID를 포함한 원본 데이터를 조회한다.
  findById(reportId: number) {
    return prisma.report.findUnique({ where: { id: reportId } });
  },

  // 만료되지 않은 리포트 중 가장 최근 월의 리포트 한 건을 조회한다.
  findLatestAvailableByUserId(userId: number, now: Date) {
    return prisma.report.findFirst({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { month: 'desc' },
    });
  },

  // 월간 배치를 생성할 전체 사용자와 각 사용자의 가입일을 조회한다.
  findUsers() {
    return prisma.user.findMany({ select: { id: true, createdAt: true } });
  },

  // (userId, month) 고유 키로 리포트를 생성하거나 집계 데이터만 갱신한다.
  upsert(userId: number, month: string, statsData: object, expiresAt: Date, createdAt: Date) {
    return prisma.report.upsert({
      where: { userId_month: { userId, month } },
      // 이미 발행된 리포트는 재시작 보정 배치가 다시 실행되어도
      // 최초 발행 시각과 만료 시각을 변경하지 않는다.
      update: { statsData },
      create: { userId, month, statsData, expiresAt, createdAt },
    });
  },

  // 이미지 생성·업로드가 끝난 리포트의 이미지 URL만 갱신한다.
  updateImageUrl(reportId: number, reportImageUrl: string) {
    return prisma.report.update({
      where: { id: reportId },
      data: { reportImageUrl },
    });
  },
};
