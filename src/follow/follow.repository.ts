import { FollowStatus, NotificationType, Prisma } from '@prisma/client';

import prisma from '../config/database';

// Follow Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.

// 목록·검색 응답에 필요한 상대 유저 최소 정보
const userSummary = {
  select: { id: true, nickname: true, uniqueTag: true, profileImageUrl: true },
} as const;

// 알림 보관 기간 30일 (PLB-038)
const NOTIFICATION_TTL_DAYS = 30;
const notificationExpiresAt = () =>
  new Date(Date.now() + NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

// 목록 type별 where 절 — 상대 닉네임 keyword 필터 포함
const buildListWhere = (
  userId: number,
  type: 'friends' | 'pending' | 'sent',
  keyword?: string,
): Prisma.FollowWhereInput => {
  const byFollowing = keyword ? { following: { nickname: { contains: keyword } } } : {};
  const byFollower = keyword ? { follower: { nickname: { contains: keyword } } } : {};

  if (type === 'pending') {
    // 받은 요청 — 내가 대상(followingId)인 PENDING
    return { status: FollowStatus.PENDING, followingId: userId, ...byFollower };
  }
  if (type === 'sent') {
    // 보낸 요청 — 내가 요청자(followerId)인 PENDING
    return { status: FollowStatus.PENDING, followerId: userId, ...byFollowing };
  }
  // friends — 수락된 관계는 row 하나로 양방향이므로 내가 어느 쪽이든 포함
  return {
    status: FollowStatus.ACCEPTED,
    OR: [
      { followerId: userId, ...byFollowing },
      { followingId: userId, ...byFollower },
    ],
  };
};

export const followRepository = {
  findUserById: (id: number) => prisma.user.findUnique({ where: { id }, select: { id: true } }),

  // 유저 검색 (PLB-032) — 닉네임 부분 일치 + 이메일 완전 일치(가입자 이메일 열거 방지), 본인 제외
  searchUsers: (userId: number, keyword: string, offset: number, limit: number) => {
    const where: Prisma.UserWhereInput = {
      id: { not: userId },
      OR: [{ nickname: { contains: keyword } }, { email: keyword }],
    };
    return prisma.$transaction([
      prisma.user.findMany({
        where,
        ...userSummary,
        orderBy: { id: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
  },

  // 나와 상대들 사이의 관계 일괄 조회 — 검색 결과의 followStatus 계산용 (방향 무관)
  findRelationsWith: (userId: number, targetIds: number[]) =>
    prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId, followingId: { in: targetIds } },
          { followerId: { in: targetIds }, followingId: userId },
        ],
      },
      select: { followerId: true, followingId: true, status: true },
    }),

  // 두 사람 사이의 관계 1건 (방향 무관) — 중복 요청 검사·친구 판정에 사용
  findRelationBetween: (userIdA: number, userIdB: number) =>
    prisma.follow.findFirst({
      where: {
        OR: [
          { followerId: userIdA, followingId: userIdB },
          { followerId: userIdB, followingId: userIdA },
        ],
      },
    }),

  findById: (followId: number) => prisma.follow.findUnique({ where: { id: followId } }),

  // 팔로우 요청 + 대상에게 FOLLOW_REQUEST 알림 (PLB-033·041, 와프 A001)
  // 알림 relatedId = followId — 알림에서 바로 POST /follows/{followId}/accept 호출 가능하도록.
  // TODO(알림 도메인 협의): 알림 생성 공용 함수가 생기면 그쪽으로 교체
  createRequestWithNotification: (followerId: number, followingId: number) =>
    prisma.$transaction(async (tx) => {
      const follow = await tx.follow.create({
        data: { followerId, followingId, status: FollowStatus.PENDING },
      });
      await tx.notification.create({
        data: {
          userId: followingId,
          type: NotificationType.FOLLOW_REQUEST,
          relatedId: follow.id,
          expiresAt: notificationExpiresAt(),
        },
      });
      return follow;
    }),

  // 수락 + 요청자에게 FOLLOW_ACCEPTED 알림 (PLB-041, 와프 A002)
  acceptWithNotification: (followId: number, followerId: number) =>
    prisma.$transaction(async (tx) => {
      const follow = await tx.follow.update({
        where: { id: followId },
        data: { status: FollowStatus.ACCEPTED },
      });
      await tx.notification.create({
        data: {
          userId: followerId,
          type: NotificationType.FOLLOW_ACCEPTED,
          relatedId: follow.id,
          expiresAt: notificationExpiresAt(),
        },
      });
      return follow;
    }),

  // 거절/취소/언팔 통합 — row 삭제, 알림 발송 없음 (PLB-041)
  deleteById: (followId: number) => prisma.follow.delete({ where: { id: followId } }),

  // 팔로우 목록 (PLB-034) — 목록과 total을 함께 조회
  findList: (
    userId: number,
    type: 'friends' | 'pending' | 'sent',
    keyword: string | undefined,
    offset: number,
    limit: number,
  ) => {
    const where = buildListWhere(userId, type, keyword);
    return prisma.$transaction([
      prisma.follow.findMany({
        where,
        include: { follower: userSummary, following: userSummary },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.follow.count({ where }),
    ]);
  },
};
