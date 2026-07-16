// User Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
// 소유권 판정·쿨다운·소셜 계정 여부 등 도메인 규칙은 userService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export const userRepository = {
  findById(userId: number) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  // 이메일 변경 요청 시 중복 체크용. 이미 확정된 email뿐 아니라 다른 유저가 변경 요청 중(pendingEmail)인
  // 이메일과도 겹치면 안 되므로 둘 다 확인한다.
  existsByEmailOrPendingEmail(email: string) {
    return prisma.user
      .findFirst({
        where: { OR: [{ email }, { pendingEmail: email }] },
        select: { id: true },
      })
      .then((found) => found !== null);
  },

  existsByNicknameTag(nickname: string, uniqueTag: string) {
    return prisma.user
      .findUnique({
        where: { nickname_uniqueTag: { nickname, uniqueTag } },
        select: { id: true },
      })
      .then((found) => found !== null);
  },

  update(userId: number, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.update({ where: { id: userId }, data });
  },

  delete(userId: number) {
    return prisma.user.delete({ where: { id: userId } });
  },

  // 비밀번호 변경 시 refreshToken을 새 값으로 덮어써 기존 세션(이전 refreshToken)을 함께 무효화한다.
  updatePassword(userId: number, passwordHash: string, refreshTokenHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        refreshToken: refreshTokenHash,
        isTempPassword: false,
      },
    });
  },

  // 이메일 변경 요청: 확정 전까지 email 컬럼은 그대로 두고 pending* 필드에만 기록한다.
  setPendingEmailChange(
    userId: number,
    pendingEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail,
        emailChangeTokenHash: tokenHash,
        emailChangeTokenExpiresAt: expiresAt,
      },
    });
  },

  // 이메일 변경 확정: email을 교체하고 pending* 필드를 모두 파기한다.
  confirmEmailChange(userId: number, newEmail: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeTokenExpiresAt: null,
      },
    });
  },
};
