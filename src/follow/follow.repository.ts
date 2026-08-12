import { FollowStatus, NotificationType, Prisma } from '@prisma/client';

import prisma from '../config/database';

// Follow Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.

// 목록·검색 응답에 필요한 상대 유저 최소 정보
const userSummary = {
  select: { id: true, nickname: true, uniqueTag: true, profileImageUrl: true, bio: true },
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

  // 프로필 링(PLB-034)용 — friendIds 중 "오늘(KST) 조회 가능한 일정이 있는" 친구 id 집합.
  // 가시성은 친구 캘린더(task.findFriendTasksByMonth) + 친구 마일스톤 조회와 동일하게 맞춘다:
  //   ① 친구의 공개(isPublic) 카테고리 마일스톤
  //   ② 그 공개 카테고리의 하위 태스크 — 작성자 무관, 카테고리 소유자(친구)에 귀속
  //   ③ 친구 본인의 독립 태스크 — categoryId·milestoneId 모두 NULL (친구 캘린더가 노출하므로 링에도 포함)
  // 비공개 카테고리는 제외(PLB-040), 완료 여부는 보지 않는다("금일 일정 존재"가 기준).
  // 오늘 판정 규칙은 알림 배치(milestone.findDueTodayWithOwner / task.find*DueToday)와 동일.
  findFriendIdsWithTodaySchedule: async (
    friendIds: number[],
    today: Date,
  ): Promise<Set<number>> => {
    if (friendIds.length === 0) {
      return new Set();
    }

    const [milestones, publicCategoryTasks, independentTasks] = await Promise.all([
      // ① 마일스톤은 userId 컬럼이 없어 소유를 카테고리(2-hop)로만 안다 — 친구의 공개 카테고리.
      prisma.milestone.findMany({
        where: {
          category: { userId: { in: friendIds }, isPublic: true },
          OR: [
            { dateType: { in: ['SINGLE', 'MULTIPLE'] }, startDate: today },
            { dateType: 'RANGE', startDate: { lte: today }, endDate: { gte: today } },
          ],
        },
        select: { category: { select: { userId: true } } },
      }),
      // ② 공개 카테고리 하위 태스크 — 카테고리 소유자(친구)에 귀속(친구 캘린더와 동일 규칙).
      prisma.task.findMany({
        where: {
          category: { is: { userId: { in: friendIds }, isPublic: true } },
          OR: [
            { dateType: 'SINGLE', startDate: today },
            { dateType: 'RANGE', startDate: { lte: today }, endDate: { gte: today } },
            { dateType: 'MULTIPLE', taskDates: { some: { date: today } } },
          ],
        },
        select: { category: { select: { userId: true } } },
      }),
      // ③ 독립 태스크 — 친구 본인 것(카테고리·마일스톤 없음).
      prisma.task.findMany({
        where: {
          userId: { in: friendIds },
          categoryId: null,
          milestoneId: null,
          OR: [
            { dateType: 'SINGLE', startDate: today },
            { dateType: 'RANGE', startDate: { lte: today }, endDate: { gte: today } },
            { dateType: 'MULTIPLE', taskDates: { some: { date: today } } },
          ],
        },
        select: { userId: true },
      }),
    ]);

    const result = new Set<number>();
    for (const milestone of milestones) {
      result.add(milestone.category.userId);
    }
    for (const task of publicCategoryTasks) {
      if (task.category) {
        result.add(task.category.userId);
      }
    }
    for (const task of independentTasks) {
      result.add(task.userId);
    }
    return result;
  },

  // 친구 일정 열람 기록 upsert (프로필 링 "안 본 일정" — hasUnviewedSchedule).
  // (viewer, target) 쌍당 1행이며 lastViewedAt을 현재 시각으로 갱신한다. 멱등(중복 호출 안전).
  upsertScheduleView: (viewerId: number, targetUserId: number) =>
    prisma.friendScheduleView.upsert({
      where: { viewerId_targetUserId: { viewerId, targetUserId } },
      create: { viewerId, targetUserId },
      update: { lastViewedAt: new Date() },
    }),

  // 뷰어의 친구별 마지막 열람 시각 조회 (hasUnviewedSchedule 계산용). 열람 기록 없으면 결과에 없다.
  findScheduleViews: (viewerId: number, targetUserIds: number[]) =>
    prisma.friendScheduleView.findMany({
      where: { viewerId, targetUserId: { in: targetUserIds } },
      select: { targetUserId: true, lastViewedAt: true },
    }),

  // 친구별 "조회 가능한 공개 일정 중 가장 최근 생성 시각(createdAt)" 맵 — hasUnviewedSchedule 계산용.
  // 가시성은 hasTodaySchedule과 동일: 공개 카테고리 마일스톤·하위 태스크 + 친구 본인 독립 태스크.
  // 신규 생성(createdAt)만 본다 — 이름·날짜 수정, 완료 체크는 링을 다시 켜지 않는다(FE 확정 스펙).
  findFriendsLatestScheduleCreatedAt: async (
    friendIds: number[],
  ): Promise<Map<number, Date>> => {
    if (friendIds.length === 0) {
      return new Map();
    }

    const [milestones, publicCategoryTasks, independentTasks] = await Promise.all([
      prisma.milestone.findMany({
        where: { category: { userId: { in: friendIds }, isPublic: true } },
        select: { createdAt: true, category: { select: { userId: true } } },
      }),
      prisma.task.findMany({
        where: { category: { is: { userId: { in: friendIds }, isPublic: true } } },
        select: { createdAt: true, category: { select: { userId: true } } },
      }),
      prisma.task.findMany({
        where: { userId: { in: friendIds }, categoryId: null, milestoneId: null },
        select: { createdAt: true, userId: true },
      }),
    ]);

    const latest = new Map<number, Date>();
    const put = (ownerId: number, createdAt: Date) => {
      const current = latest.get(ownerId);
      if (!current || createdAt > current) {
        latest.set(ownerId, createdAt);
      }
    };
    for (const milestone of milestones) {
      put(milestone.category.userId, milestone.createdAt);
    }
    for (const task of publicCategoryTasks) {
      if (task.category) {
        put(task.category.userId, task.createdAt);
      }
    }
    for (const task of independentTasks) {
      put(task.userId, task.createdAt);
    }
    return latest;
  },
};
