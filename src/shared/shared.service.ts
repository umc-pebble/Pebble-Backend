// SharedCategory Service
// 비즈니스 로직 계층. 공유 전환/멤버 초대/수락·거절/탈퇴/강퇴/삭제 규칙 담당 (PLB-044~048).
// DB 쿼리는 sharedRepository에 위임하고, 규칙 위반 시 AppError를 던진다.

import { AppError } from '../utils/app-error';
import { sharedRepository } from './shared.repository';
import { InviteTarget } from './shared.schema';

async function getCategoryOrThrow(categoryId: number) {
  const category = await sharedRepository.findCategoryById(categoryId);
  if (!category) {
    throw new AppError('COMMON_NOT_FOUND', '카테고리를 찾을 수 없습니다.');
  }
  return category;
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
  const isFriend = await sharedRepository.isFriend(ownerId, targetUserId);
  if (!isFriend) {
    throw new AppError('CATEGORY_NOT_FRIEND', '팔로잉 관계가 아닌 유저는 초대할 수 없습니다.');
  }
  const existing = await sharedRepository.findMembership(categoryId, targetUserId);
  if (existing) {
    throw new AppError('CATEGORY_MEMBER_DUPLICATED', '이미 초대되었거나 멤버인 유저입니다.');
  }
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

    // 같은 요청 안에서 같은 대상이 nickname/email로 중복 지정된 경우, resolve된 userId
    // 기준으로 조용히 한 번만 처리한다 (안 그러면 아래 트랜잭션의 유니크 제약에서 터짐).
    const targets = [];
    const seenUserIds = new Set<number>();
    for (const invite of invites) {
      const user = await resolveInviteTarget(invite);
      if (seenUserIds.has(user.id)) {
        continue;
      }
      seenUserIds.add(user.id);
      await assertInvitable(userId, categoryId, user.id);
      targets.push(user);
    }

    // 전환(isShared) + 오너 등록 + 초대 등록을 하나의 트랜잭션으로 묶는다 — 중간에 실패해도
    // 부분 반영된 상태(예: isShared=true인데 멤버가 없는 상태)가 남지 않는다.
    const members = await sharedRepository.shareCategoryTransaction(
      categoryId,
      userId,
      targets.map((t) => t.id),
    );

    // 알림은 트랜잭션에 안 묶는다 — 발송 실패가 이미 성공한 카테고리 전환을 되돌릴 이유는 없다.
    await Promise.all(
      targets.map((t) => sharedRepository.createNotification(t.id, 'CATEGORY_INVITE', categoryId)),
    );

    return members;
  },

  // 이미 공유 중인 카테고리에 멤버를 한 명 추가 초대한다 (PLB-048). 오너만 가능하다.
  async inviteMember(userId: number, categoryId: number, target: InviteTarget) {
    await getSharedCategoryOrThrow(categoryId);
    await getOwnerMembershipOrThrow(categoryId, userId);

    const user = await resolveInviteTarget(target);
    await assertInvitable(userId, categoryId, user.id);

    const member = await sharedRepository.createMember(categoryId, user.id, 'MEMBER', 'PENDING');
    await sharedRepository.createNotification(user.id, 'CATEGORY_INVITE', categoryId);
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
  async respondInvite(userId: number, categoryId: number, action: 'ACCEPT' | 'REJECT') {
    const membership = await sharedRepository.findMembership(categoryId, userId);
    if (!membership || membership.status !== 'PENDING') {
      throw new AppError('COMMON_NOT_FOUND', '대기 중인 초대를 찾을 수 없습니다.');
    }
    if (action === 'ACCEPT') {
      await sharedRepository.updateMemberStatus(categoryId, userId, 'ACCEPTED');
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
      notifyTargets.map((m) =>
        sharedRepository.createNotification(m.userId, 'CATEGORY_DELETED', categoryId),
      ),
    );
  },
};
