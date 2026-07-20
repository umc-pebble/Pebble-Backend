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
  // 이메일과도 겹치면 안 되므로 둘 다 확인한다. 본인의 이전 pendingEmail 재요청(토큰 만료 후 재시도 등)은
  // 충돌로 보지 않도록 자기 자신은 제외한다.
  existsByEmailOrPendingEmail(userId: number, email: string) {
    return prisma.user
      .findFirst({
        where: { OR: [{ email }, { pendingEmail: email, NOT: { id: userId } }] },
        select: { id: true },
      })
      .then((found) => found !== null);
  },

  // 본인의 현재 (nickname, uniqueTag) 조합은 충돌로 보지 않도록 자기 자신은 제외한다.
  existsByNicknameTag(nickname: string, uniqueTag: string, excludeUserId: number) {
    return prisma.user
      .findFirst({
        where: { nickname, uniqueTag, NOT: { id: excludeUserId } },
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
  // 쿨다운(1분)·시간당 상한 조건을 where에 실어 원자적으로 체크한다 — 사전 검증(서비스)을 동시 요청
  // 두 개가 모두 통과해도, 실제 반영 시점엔 조건을 다시 만족하는 하나만 성공한다(count===0이면 경합 패배).
  setPendingEmailChange(
    userId: number,
    pendingEmail: string,
    tokenHash: string,
    expiresAt: Date,
    rateLimit: {
      now: Date;
      cooldownBoundary: Date;
      windowExpired: boolean;
      currentWindowStart: Date | null;
      windowBoundary: Date;
      maxRequestsPerWindow: number;
    },
  ) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        AND: [
          {
            OR: [
              { emailChangeLastRequestedAt: null },
              { emailChangeLastRequestedAt: { lte: rateLimit.cooldownBoundary } },
            ],
          },
          rateLimit.windowExpired
            ? {
                OR: [
                  { emailChangeRequestWindowStart: null },
                  { emailChangeRequestWindowStart: { lte: rateLimit.windowBoundary } },
                ],
              }
            : {
                emailChangeRequestWindowStart: rateLimit.currentWindowStart,
                emailChangeRequestCount: { lt: rateLimit.maxRequestsPerWindow },
              },
        ],
      },
      data: {
        pendingEmail,
        emailChangeTokenHash: tokenHash,
        emailChangeTokenExpiresAt: expiresAt,
        emailChangeLastRequestedAt: rateLimit.now,
        emailChangeRequestWindowStart: rateLimit.windowExpired ? rateLimit.now : rateLimit.currentWindowStart,
        emailChangeRequestCount: rateLimit.windowExpired ? 1 : { increment: 1 },
      },
    });
  },

  // 인증 메일 발송 실패 시 롤백용: 방금 써둔 pending* 예약과 rate limit 반영분을 되돌려
  // 다른 유저가 같은 이메일을 요청할 수 있게 하고, 실패한 시도가 본인의 쿨다운/상한을
  // 갉아먹지 않게 한다. confirmEmailChange와 동일하게 그사이 값이 바뀌었다면
  // (예: 재요청으로 새 토큰 발급) where가 매칭되지 않아 조용히 무시된다 — 의도된 동작이다.
  clearPendingEmailChange(
    userId: number,
    pendingEmail: string,
    tokenHash: string,
    previousRateLimit: { lastRequestedAt: Date | null; windowStart: Date | null; count: number },
  ) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        pendingEmail,
        emailChangeTokenHash: tokenHash,
      },
      data: {
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeTokenExpiresAt: null,
        emailChangeLastRequestedAt: previousRateLimit.lastRequestedAt,
        emailChangeRequestWindowStart: previousRateLimit.windowStart,
        emailChangeRequestCount: previousRateLimit.count,
      },
    });
  },

  // 이메일 변경 확정: email을 교체하고 pending* 필드를 모두 파기한다.
  // pendingEmail·토큰 해시·만료 조건을 where에 포함해 조건부로 갱신함으로써, 서비스의 토큰 검증 이후
  // 다른 요청이 pending 정보를 교체하는 경쟁 상황에서도 이전 상태 기준으로만 확정되도록 한다.
  // (count가 0이면 그 사이 pending 정보가 바뀐 것이므로 서비스에서 실패로 처리해야 한다.)
  confirmEmailChange(userId: number, newEmail: string, tokenHash: string) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        pendingEmail: newEmail,
        emailChangeTokenHash: tokenHash,
        emailChangeTokenExpiresAt: { gt: new Date() },
      },
      data: {
        email: newEmail,
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeTokenExpiresAt: null,
      },
    });
  },
};
