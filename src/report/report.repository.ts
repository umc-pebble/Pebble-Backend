// Report Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
import prisma from '../config/database';

export const reportRepository = {
  findAvailableByUserId(userId: number, now: Date) {
    return prisma.report.findMany({
      where: { userId, expiresAt: { gt: now } },
    });
  },
};