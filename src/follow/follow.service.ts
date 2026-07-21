import { FollowStatus, Prisma } from '@prisma/client';

import { AppError } from '../utils/app-error';

import { followRepository } from './follow.repository';
import { SearchUsersQuery, FollowListQuery } from './follow.schema';

// Follow Service
// 비즈니스 로직 계층. 검색/요청(중복·자기자신 방지)/수락·거절/취소 규칙 담당.

// 검색 결과의 팔로우 버튼 상태 (PLB-033)
type FollowButtonStatus = 'NONE' | 'PENDING' | 'ACCEPTED';

// 두 유저가 수락된 친구 관계인지 판정 (방향 무관).
// 수락된 관계는 row 하나로 양방향이므로, 친구 전용 열람(징검다리·캘린더 등)에서 재사용하도록 export한다.
export const isFriend = async (userIdA: number, userIdB: number) => {
  if (userIdA === userIdB) {
    return false;
  }
  const relation = await followRepository.findRelationBetween(userIdA, userIdB);
  return relation?.status === FollowStatus.ACCEPTED;
};

export const followService = {
  // 유저 검색 (PLB-032) — 닉네임 부분 일치 / 이메일 완전 일치, 본인 제외
  searchUsers: async (userId: number, query: SearchUsersQuery) => {
    const { keyword, offset, limit } = query;
    const [users, total] = await followRepository.searchUsers(userId, keyword, offset, limit);

    // 각 유저와 나의 관계를 한 번에 조회해 버튼 상태로 변환
    const relations = await followRepository.findRelationsWith(
      userId,
      users.map((user) => user.id),
    );
    const statusByUserId = new Map<number, FollowButtonStatus>(
      relations.map((relation) => [
        relation.followerId === userId ? relation.followingId : relation.followerId,
        relation.status as FollowButtonStatus,
      ]),
    );

    const data = users.map((user) => ({
      userId: user.id,
      nickname: user.nickname,
      uniqueTag: user.uniqueTag,
      profileImageUrl: user.profileImageUrl,
      followStatus: statusByUserId.get(user.id) ?? 'NONE',
    }));

    return { data, page: { offset, limit, total } };
  },

  // 팔로우 요청 (PLB-033·041) — 자기 자신 불가, 이미 관계가 있으면 중복
  requestFollow: async (userId: number, targetUserId: number) => {
    if (userId === targetUserId) {
      throw new AppError('FOLLOW_SELF', '자기 자신은 팔로우할 수 없습니다.');
    }

    const target = await followRepository.findUserById(targetUserId);
    if (!target) {
      throw new AppError('COMMON_NOT_FOUND', '존재하지 않는 유저입니다.');
    }

    const existing = await followRepository.findRelationBetween(userId, targetUserId);
    if (existing) {
      throw new AppError(
        'FOLLOW_DUPLICATED',
        existing.status === FollowStatus.ACCEPTED
          ? '이미 팔로우 중인 유저입니다.'
          : '이미 팔로우 요청 중입니다.',
      );
    }

    // 위 사전 조회는 빠른 경로일 뿐이고, 동시에 같은 요청이 들어오면
    // DB unique 제약(followerId·followingId)이 최후 방어선이 된다.
    try {
      const follow = await followRepository.createRequestWithNotification(userId, targetUserId);
      return { followId: follow.id, status: follow.status };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('FOLLOW_DUPLICATED', '이미 팔로우 요청 중입니다.');
      }
      throw err;
    }
  },

  // 팔로우 수락 (PLB-041) — 요청 수신자만 가능
  acceptFollow: async (userId: number, followId: number) => {
    const follow = await followRepository.findById(followId);
    if (!follow) {
      throw new AppError('COMMON_NOT_FOUND', '팔로우 요청을 찾을 수 없습니다.');
    }
    if (follow.followingId !== userId) {
      throw new AppError('COMMON_FORBIDDEN', '수락 권한이 없습니다.');
    }
    if (follow.status === FollowStatus.ACCEPTED) {
      throw new AppError('FOLLOW_DUPLICATED', '이미 수락된 요청입니다.');
    }

    const accepted = await followRepository.acceptWithNotification(followId, follow.followerId);
    return { followId: accepted.id, status: accepted.status };
  },

  // 거절 / 취소 / 언팔 통합 (PLB-034·041) — 당사자면 누구든 삭제 가능, 알림 없음
  deleteFollow: async (userId: number, followId: number) => {
    const follow = await followRepository.findById(followId);
    if (!follow) {
      throw new AppError('COMMON_NOT_FOUND', '팔로우 정보를 찾을 수 없습니다.');
    }
    if (follow.followerId !== userId && follow.followingId !== userId) {
      throw new AppError('COMMON_FORBIDDEN', '처리 권한이 없습니다.');
    }

    await followRepository.deleteById(followId);
  },

  // 팔로우 목록 (PLB-034) — friends(맞팔) / pending(받은 요청) / sent(보낸 요청)
  getFollows: async (userId: number, query: FollowListQuery) => {
    const { type, keyword, offset, limit } = query;
    const [follows, total] = await followRepository.findList(userId, type, keyword, offset, limit);

    const data = follows.map((follow) => {
      // row 하나로 양방향이므로 내가 아닌 쪽이 상대
      const other = follow.followerId === userId ? follow.following : follow.follower;
      return {
        followId: follow.id,
        userId: other.id,
        nickname: other.nickname,
        uniqueTag: other.uniqueTag,
        profileImageUrl: other.profileImageUrl,
        // TODO(일정 도메인 연동): 금일 일정 유무는 마일스톤·태스크 조회가 필요하고
        // 비공개 카테고리 제외 규칙(PLB-040)과도 얽혀 있어 협의 후 계산 예정
        hasTodaySchedule: false,
      };
    });

    return { data, page: { offset, limit, total } };
  },
};
