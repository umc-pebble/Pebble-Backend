import { Prisma } from '@prisma/client';

import prisma from '../config/database';

// Auth Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.

export const authRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  findById: (id: number) => prisma.user.findUnique({ where: { id } }),

  // 닉네임#태그 조합 유일성 확인 (@@unique([nickname, uniqueTag]))
  existsByNicknameTag: async (nickname: string, uniqueTag: string) => {
    const found = await prisma.user.findUnique({
      where: { nickname_uniqueTag: { nickname, uniqueTag } },
      select: { id: true },
    });
    return found !== null;
  },

  createUser: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),

  // 로그인·회원가입 최초 발급, 로그아웃 시 null 파기 (무조건 갱신)
  updateRefreshToken: (userId: number, refreshTokenHash: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { refreshToken: refreshTokenHash } }),

  // 재발급 회전용 조건부 갱신(CAS) — 기존 해시가 일치할 때만 갱신되어, 동시 재발급 중 1건만 성공한다.
  // 반환 count가 0이면 유저 없음 / 해시 불일치 / 동시 요청 패배.
  rotateRefreshToken: (userId: number, oldHash: string, newHash: string) =>
    prisma.user.updateMany({
      where: { id: userId, refreshToken: oldHash },
      data: { refreshToken: newHash },
    }),
};
