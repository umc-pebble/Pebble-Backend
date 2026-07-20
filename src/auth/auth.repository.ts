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

  // 유저 생성 + refresh 토큰 해시 저장을 한 트랜잭션으로 묶는다 (회원가입 전용) —
  // 토큰 저장이 실패하면 계정 생성도 함께 취소되어 "가입 실패인데 계정만 남는" 상황을 막는다.
  // 토큰 서명(jwt)은 service 책임이므로, userId를 받아 해시를 돌려주는 콜백으로 위임받는다.
  createUserWithRefreshToken: (
    data: Prisma.UserCreateInput,
    refreshHashFor: (userId: number) => string,
  ) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data });
      return tx.user.update({
        where: { id: created.id },
        data: { refreshToken: refreshHashFor(created.id) },
      });
    }),

  // 로그인 시 발급 해시 저장, 로그아웃 시 null 파기 (무조건 갱신)
  updateRefreshToken: (userId: number, refreshTokenHash: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { refreshToken: refreshTokenHash } }),

  // 재발급 회전용 조건부 갱신(CAS) — 기존 해시가 일치할 때만 갱신되어, 동시 재발급 중 1건만 성공한다.
  // 반환 count가 0이면 유저 없음 / 해시 불일치 / 동시 요청 패배.
  rotateRefreshToken: (userId: number, oldHash: string, newHash: string) =>
    prisma.user.updateMany({
      where: { id: userId, refreshToken: oldHash },
      data: { refreshToken: newHash },
    }),

  // 임시 비밀번호 발급·원복 겸용 (PLB-035) — 비밀번호 해시와 플래그를 함께 갱신한다.
  // refreshToken은 건드리지 않는다: 제3자가 남의 이메일로 발급 요청해도 피해자의 기존 세션은 유지.
  updatePasswordWithTempFlag: (userId: number, passwordHash: string, isTempPassword: boolean) =>
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash, isTempPassword },
    }),
};
