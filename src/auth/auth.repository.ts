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

  // null 전달 시 refresh 토큰 파기 (로그아웃·비밀번호 변경)
  updateRefreshToken: (userId: number, refreshTokenHash: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { refreshToken: refreshTokenHash } }),
};
