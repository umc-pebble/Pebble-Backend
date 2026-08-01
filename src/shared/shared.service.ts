// SharedCategory Service
// 비즈니스 로직 계층. 공유 전환/멤버 초대/수락·거절/탈퇴/강퇴/삭제 규칙 담당 (PLB-044~048).
// DB 쿼리는 sharedRepository에 위임하고, 규칙 위반 시 AppError를 던진다.

import { NotificationType, Prisma } from '@prisma/client';
import { isFriend } from '../follow/follow.service';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { sharedRepository } from './shared.repository';
import { InviteTarget } from './shared.schema';

// 알림 발송 실패가 이미 커밋된 상태 변경(전환/강퇴/삭제 등)을 클라이언트 응답 실패로
// 보이게 만들면 안 된다 — 실패는 로그만 남기고 삼킨다. Promise.all은 하나라도 reject되면
// 즉시 전체를 reject시키므로, 알림 발송에 그대로 쓰면 이미 성공한 작업까지 에러 응답이 나간다.
async function notifySafely(userId: number, type: NotificationType, relatedId: number) {
  try {
    await sharedRepository.createNotification(userId, type, relatedId);
  } catch (err) {
    logger.error('[shared] 알림 발송 실패', { userId, type, relatedId, err });
  }
}

// 카테고리 오너가 아닌 유저가 "공유 카테고리의 ACCEPTED 멤버"로서 접근 가능한지 판정한다.
// Category/Milestone/Task 등 다른 도메인이 자체 소유권 체크에 "공유 멤버도 허용"을 얹을 때
// 재사용한다 (follow.service의 isFriend와 동일한 cross-domain 재사용 패턴).
export async function isAcceptedSharedMember(userId: number, categoryId: number): Promise<boolean> {
  const membership = await sharedRepository.findMembership(categoryId, userId);
  return membership?.status === 'ACCEPTED';
}

async function getCategoryOrThrow(categoryId: number) {
  const category = await sharedRepository.findCategoryById(categoryId);
  if (!category) {
    throw new AppError('COMMON_NOT_FOUND', '카테고리를 찾을 수 없습니다.');
  }
  return category;
}

// 카테고리 "생성과 동시에 초대"(PLB-044)에서 categoryService가 재사용한다. Category 도메인의
// 생성 요청은 이미 userId로 확정된 대상 목록(inviteUserIds)을 받으므로 nickname/email 조회 없이
// 바로 검증한다. shareCategory(POST /categories/{id}/share)와 동일하게 all-or-nothing이다.
// 존재 확인은 findUsersByIds로 한 번에 조회한다(대상마다 findUserById를 부르는 N+1 방지).
export async function shareCategoryWithUserIds(
  ownerId: number,
  categoryId: number,
  inviteeUserIds: number[],
) {
  const uniqueIds = [...new Set(inviteeUserIds)];
  const users = await sharedRepository.findUsersByIds(uniqueIds);
  if (users.length !== uniqueIds.length) {
    throw new AppError('COMMON_NOT_FOUND', '대상 유저를 찾을 수 없습니다.');
  }
  return shareCategoryWithResolvedUsers(ownerId, categoryId, users);
}

// invite/getMembers/removeMember/delete는 "이미 공유 중인" 카테고리를 전제로 한다.
async function getSharedCategoryOrThrow(categoryId: number) {
  const category = await sharedRepository.findCategoryById(categoryId);
  if (!category || !category.isShared) {
    throw new AppError('COMMON_NOT_FOUND', '공유 카테고리를 찾을 수 없습니다.');
  }
  return category;
}

// 오너 멤버십을 조회·검증한다. 오너가 아니면 403.
async function getOwnerMembershipOrThrow(categoryId: number, userId: number) {
  const membership = await sharedRepository.findMembership(categoryId, userId);
  if (!membership || membership.role !== 'OWNER') {
    throw new AppError('CATEGORY_NOT_OWNER', '공유 카테고리의 오너만 가능한 작업입니다.');
  }
  return membership;
}

// 닉네임/이메일로 초대 대상을 실제 유저로 해석한다. 없으면 404.
async function resolveInviteTarget(target: InviteTarget) {
  const user = await sharedRepository.findUserByNicknameOrEmail(target);
  if (!user) {
    throw new AppError('COMMON_NOT_FOUND', '대상 유저를 찾을 수 없습니다.');
  }
  return user;
}

// 자기 자신 초대 방지 + 친구 관계 + 중복 멤버 여부를 검증한다. 문제가 있으면 바로 throw한다.
async function assertInvitable(ownerId: number, categoryId: number, targetUserId: number) {
  if (targetUserId === ownerId) {
    throw new AppError('COMMON_INVALID_INPUT', '자기 자신은 초대할 수 없습니다.');
  }
  const areFriends = await isFriend(ownerId, targetUserId);
  if (!areFriends) {
    throw new AppError('CATEGORY_NOT_FRIEND', '팔로잉 관계가 아닌 유저는 초대할 수 없습니다.');
  }
  const existing = await sharedRepository.findMembership(categoryId, targetUserId);
  if (existing) {
    throw new AppError('CATEGORY_MEMBER_DUPLICATED', '이미 초대되었거나 멤버인 유저입니다.');
  }
}

// shareCategory(닉네임/이메일 기반)와 shareCategoryWithUserIds(userId 기반, PLB-044 카테고리
// 생성과 동시에 초대)가 공유하는 핵심 로직. 대상을 전부 먼저 검증한 뒤 트랜잭션으로 한꺼번에
// 반영한다 — 일부만 성공하는 상태를 만들지 않는다(all-or-nothing).
//
// 자기자신 필터링 + 기존 멤버십 확인은 대상 전체를 한 번에 처리한다(최대 50명 기준 대상마다
// 순차 쿼리를 날리면 요청 하나에서 DB 왕복이 과도하게 늘어난다). 친구 관계만은 follow 도메인에
// 배치 조회가 없어 대상별로 확인한다.
async function shareCategoryWithResolvedUsers(
  ownerId: number,
  categoryId: number,
  users: { id: number }[],
) {
  const seenUserIds = new Set<number>();
  const targets = users.filter((user) => {
    if (seenUserIds.has(user.id)) {
      return false;
    }
    seenUserIds.add(user.id);
    return true;
  });

  if (targets.some((t) => t.id === ownerId)) {
    throw new AppError('COMMON_INVALID_INPUT', '자기 자신은 초대할 수 없습니다.');
  }

  if (targets.length > 0) {
    const existingMemberships = await sharedRepository.findMemberships(
      categoryId,
      targets.map((t) => t.id),
    );
    if (existingMemberships.length > 0) {
      throw new AppError('CATEGORY_MEMBER_DUPLICATED', '이미 초대되었거나 멤버인 유저입니다.');
    }
  }

  for (const target of targets) {
    const areFriends = await isFriend(ownerId, target.id);
    if (!areFriends) {
      throw new AppError('CATEGORY_NOT_FRIEND', '팔로잉 관계가 아닌 유저는 초대할 수 없습니다.');
    }
  }

  // 위 사전 검증 이후에도 동시 요청이 같은 대상을 먼저 등록하면 createMany가
  // 유니크 제약(P2002)에 걸린다 — shareCategoryTransaction의 isShared 레이스 가드와
  // 같은 이유로, 사전 체크는 빠른 경로일 뿐이고 이게 최후 방어선이다.
  let members;
  try {
    members = await sharedRepository.shareCategoryTransaction(
      categoryId,
      ownerId,
      targets.map((t) => t.id),
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CATEGORY_MEMBER_DUPLICATED', '이미 초대되었거나 멤버인 유저입니다.');
    }
    throw err;
  }

  if (members === null) {
    throw new AppError(
      'COMMON_INVALID_INPUT',
      '이미 공유 중인 카테고리입니다. 멤버 추가는 다른 API를 사용해주세요.',
    );
  }

  await Promise.all(targets.map((t) => notifySafely(t.id, 'CATEGORY_INVITE', categoryId)));

  return members;
}

export const sharedService = {
  // 개인 카테고리를 공유로 전환하고 초대 목록을 등록한다 (PLB-044).
  // 초대 대상을 전부 먼저 검증한 뒤 한꺼번에 반영한다 — 일부만 성공하는 상태를 만들지 않는다.
  async shareCategory(userId: number, categoryId: number, invites: InviteTarget[]) {
    const category = await getCategoryOrThrow(categoryId);
    if (category.userId !== userId) {
      throw new AppError('COMMON_FORBIDDEN', '해당 카테고리에 접근할 권한이 없습니다.');
    }
    if (category.isShared) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '이미 공유 중인 카테고리입니다. 멤버 추가는 다른 API를 사용해주세요.',
      );
    }

    // 같은 요청 안에서 같은 대상이 nickname/email로 중복 지정될 수 있어 resolve부터 한다
    // (중복 제거는 shareCategoryWithResolvedUsers가 resolve된 userId 기준으로 처리한다).
    const users = [];
    for (const invite of invites) {
      users.push(await resolveInviteTarget(invite));
    }

    return shareCategoryWithResolvedUsers(userId, categoryId, users);
  },

  // 이미 공유 중인 카테고리에 멤버를 한 명 추가 초대한다 (PLB-048). 오너만 가능하다.
  async inviteMember(userId: number, categoryId: number, target: InviteTarget) {
    await getSharedCategoryOrThrow(categoryId);
    await getOwnerMembershipOrThrow(categoryId, userId);

    const user = await resolveInviteTarget(target);
    await assertInvitable(userId, categoryId, user.id);

    const member = await sharedRepository.createMember(categoryId, user.id, 'MEMBER', 'PENDING');
    await notifySafely(user.id, 'CATEGORY_INVITE', categoryId);
    return member;
  },

  // 공유 카테고리 멤버 목록 조회. 수락된 멤버만 조회할 수 있다.
  async getMembers(userId: number, categoryId: number) {
    await getSharedCategoryOrThrow(categoryId);
    const membership = await sharedRepository.findMembership(categoryId, userId);
    if (!membership || membership.status !== 'ACCEPTED') {
      throw new AppError('COMMON_FORBIDDEN', '이 카테고리의 멤버가 아닙니다.');
    }
    return sharedRepository.findMembers(categoryId);
  },

  // 나에게 온 초대를 수락/거절한다 (PLB-044). 대기 중(PENDING)인 초대만 대상이다.
  // 수락 시 오너에게 CATEGORY_ACCEPTED 알림을 보낸다 — Category.userId는 공유 전환 이후에도
  // 바뀌지 않는 오너 필드라 그대로 수신자로 쓸 수 있다.
  async respondInvite(userId: number, categoryId: number, action: 'ACCEPT' | 'REJECT') {
    const membership = await sharedRepository.findMembership(categoryId, userId);
    if (!membership || membership.status !== 'PENDING') {
      throw new AppError('COMMON_NOT_FOUND', '대기 중인 초대를 찾을 수 없습니다.');
    }
    if (action === 'ACCEPT') {
      await sharedRepository.updateMemberStatus(categoryId, userId, 'ACCEPTED');
      const category = await sharedRepository.findCategoryById(categoryId);
      if (category) {
        await notifySafely(category.userId, 'CATEGORY_ACCEPTED', categoryId);
      }
    } else {
      await sharedRepository.deleteMembership(categoryId, userId);
    }
  },

  // 자진 탈퇴. 오너는 탈퇴할 수 없고 공유 삭제를 사용해야 한다 (PLB-045).
  async leaveSharedCategory(userId: number, categoryId: number) {
    const membership = await sharedRepository.findMembership(categoryId, userId);
    if (!membership) {
      throw new AppError('COMMON_NOT_FOUND', '멤버가 아닙니다.');
    }
    if (membership.role === 'OWNER') {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '오너는 탈퇴할 수 없습니다. 공유 삭제를 이용해주세요.',
      );
    }
    await sharedRepository.deleteMembership(categoryId, userId);
  },

  // 오너가 특정 멤버를 강퇴한다. 강퇴 알림은 발송하지 않는다 (PLB-045).
  async removeMember(ownerId: number, categoryId: number, targetUserId: number) {
    await getSharedCategoryOrThrow(categoryId);
    await getOwnerMembershipOrThrow(categoryId, ownerId);

    const target = await sharedRepository.findMembership(categoryId, targetUserId);
    if (!target) {
      throw new AppError('COMMON_NOT_FOUND', '해당 멤버를 찾을 수 없습니다.');
    }
    if (target.role === 'OWNER') {
      throw new AppError('COMMON_INVALID_INPUT', '오너는 강퇴할 수 없습니다.');
    }
    await sharedRepository.deleteMembership(categoryId, targetUserId);
  },

  // 오너가 공유 카테고리를 삭제한다. 하위 마일스톤/태스크/멤버십은 CASCADE로 함께 삭제된다.
  // 삭제 전에 멤버 목록을 모아둬야 알림을 보낼 수 있다 (PLB-046).
  async deleteSharedCategory(userId: number, categoryId: number) {
    await getSharedCategoryOrThrow(categoryId);
    await getOwnerMembershipOrThrow(categoryId, userId);

    const members = await sharedRepository.findMembers(categoryId);
    const notifyTargets = members.filter((m) => m.userId !== userId && m.status === 'ACCEPTED');

    await sharedRepository.deleteCategory(categoryId);

    await Promise.all(
      notifyTargets.map((m) => notifySafely(m.userId, 'CATEGORY_DELETED', categoryId)),
    );
  },
};
