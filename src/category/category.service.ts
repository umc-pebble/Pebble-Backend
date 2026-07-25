// Category Service
// 비즈니스 로직 계층. Controller와 Repository 사이에서 도메인 규칙(소유권·기본값 처리)을 담당한다.
// DB 쿼리는 categoryRepository에 위임하고, 규칙 위반 시 AppError를 던진다(포맷은 error.middleware가 통일).

import { AppError } from '../utils/app-error';
import { isFriend } from '../follow/follow.service';
import { categoryRepository } from './category.repository';

// 참고: 개수 제한(CATEGORY_LIMIT_EXCEEDED) 생략
interface CreateCategoryInput {
  name: string;
  color: string;
  imageUrl?: string | null;
  isPublic?: boolean;
  isCompleted?: boolean;
  inviteUserIds?: number[] | null;
}

interface UpdateCategoryInput {
  name?: string;
  color?: string;
  imageUrl?: string | null;
  isCompleted?: boolean;
  isPublic?: boolean;
  isHidden?: boolean;
}

// 소유 카테고리 조회 + 소유권 검증. 없으면 404, 본인 소유가 아니면 403.
// 소유권 판정을 이 한 곳에 모아 조회/수정/삭제가 동일하게 재사용한다.
async function getOwnedCategoryOrThrow(userId: number, categoryId: number) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) {
    throw new AppError('COMMON_NOT_FOUND', '카테고리를 찾을 수 없습니다.');
  }
  if (category.userId !== userId) {
    throw new AppError('COMMON_FORBIDDEN', '해당 카테고리에 접근할 권한이 없습니다.');
  }
  return category;
}

// 친구 프로필 조회(#64) 접근 판정. 대상 유저가 존재하고, 본인이거나 수락된 친구여야 한다.
// 친구 판정은 follow 도메인의 isFriend를 재사용한다(팔로우 로직을 여기서 다시 만들지 않는다).
// milestone friend-view도 같은 규칙을 써야 하므로 이 한 곳에 모아 재사용한다.
async function assertFriendProfileAccess(requesterId: number, targetUserId: number) {
  const target = await categoryRepository.findUserById(targetUserId);
  if (!target) {
    throw new AppError('COMMON_NOT_FOUND', '유저를 찾을 수 없습니다.');
  }
  // 본인 조회는 허용(활동기록 조회와 동일 규칙). 그 외에는 수락된 친구만 가능.
  if (requesterId === targetUserId) {
    return;
  }
  const areFriends = await isFriend(requesterId, targetUserId);
  if (!areFriends) {
    throw new AppError('COMMON_FORBIDDEN', '친구의 프로필만 조회할 수 있습니다.');
  }
}

export const categoryService = {
  // 내 카테고리 목록 (displayOrder 순은 repository가 보장).
  getCategories(userId: number) {
    return categoryRepository.findManyByUserId(userId);
  },

  // 친구(또는 본인)의 공개 카테고리 목록 (#64·PLB-040). 비공개(isPublic=false)는 노출하지 않는다.
  async getFriendCategories(requesterId: number, targetUserId: number) {
    await assertFriendProfileAccess(requesterId, targetUserId);
    return categoryRepository.findPublicManyByUserId(targetUserId);
  },

  // 친구 프로필에서 특정 카테고리 1건을 검증해 반환한다(하위 마일스톤 조회 등에서 재사용).
  // 접근 판정 후, 그 카테고리가 대상 유저 소유이면서 공개(isPublic=true)일 때만 반환한다.
  // 남의 비공개 카테고리는 존재 자체를 숨기기 위해 403이 아닌 404로 처리한다.
  async getFriendPublicCategory(
    requesterId: number,
    targetUserId: number,
    categoryId: number,
  ) {
    await assertFriendProfileAccess(requesterId, targetUserId);
    const category = await categoryRepository.findById(categoryId);
    if (!category || category.userId !== targetUserId || !category.isPublic) {
      throw new AppError('COMMON_NOT_FOUND', '카테고리를 찾을 수 없습니다.');
    }
    return category;
  },

  // 단건 조회 (소유권 검증 포함).
  getCategory(userId: number, categoryId: number) {
    return getOwnedCategoryOrThrow(userId, categoryId);
  },

  // 카테고리 생성.
  async createCategory(userId: number, input: CreateCategoryInput) {
    // 초대(inviteUserIds)는 준비 중 — 구현 전까지 명시적으로 거부한다.
    // (조용히 무시하면 클라이언트가 초대가 전달된 것으로 오해하므로, 반쪽 성공 대신 400)
    // TODO(shared 경계 협의 후): 요청자 OWNER 등록 + 팔로잉 검증 후 초대자 PENDING 등록,
    //   초대 일부 실패해도 생성은 성공(부분 성공) → { category, invites }로 반환, isShared=true 설정.
    if (Array.isArray(input.inviteUserIds) && input.inviteUserIds.length > 0) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '카테고리 초대 기능은 준비 중입니다. inviteUserIds 없이 생성해주세요.',
      );
    }

    // displayOrder(맨 뒤 순번)는 repository가 트랜잭션 안에서 원자적으로 채번한다.
    // (개수 제한 검사는 상한 숫자 확정 후 여기에 추가)
    const category = await categoryRepository.create({
      userId,
      name: input.name,
      color: input.color,
      imageUrl: input.imageUrl ?? null,
      // 확정값: 기본 비공개(false). 스키마 기본값(true)을 서비스에서 명시적으로 덮는다.
      isPublic: input.isPublic ?? false,
      isCompleted: input.isCompleted ?? false,
    });

    return { category };
  },

  // 부분 수정 (전달된 필드만 반영). 소유권 검증 후 위임.
  async updateCategory(
    userId: number,
    categoryId: number,
    input: UpdateCategoryInput,
  ) {
    await getOwnedCategoryOrThrow(userId, categoryId);
    return categoryRepository.update(categoryId, {
      name: input.name,
      color: input.color,
      imageUrl: input.imageUrl,
      isCompleted: input.isCompleted,
      isPublic: input.isPublic,
      isHidden: input.isHidden,
    });
  },

  // 삭제 (하위 milestone/task/member는 CASCADE). 소유권 검증 후 위임.
  async deleteCategory(userId: number, categoryId: number) {
    await getOwnedCategoryOrThrow(userId, categoryId);
    await categoryRepository.delete(categoryId);
  },

  // 순서 일괄 변경. orderedIds는 "본인 소유 전체 카테고리의 재배열(순열)"이어야 한다.
  // 일부만 보내면 누락분이 기존 순번을 유지해 displayOrder가 겹치므로 개수 일치까지 검증한다.
  // 클라이언트는 사이드바에 보이는 전체 카테고리를 화면 순서대로 보낸다(페이지네이션 없음).
  async reorderCategories(userId: number, orderedIds: number[]) {
    const owned = await categoryRepository.findManyByUserId(userId);
    const ownedIds = new Set(owned.map((c) => c.id));

    const hasDuplicate = new Set(orderedIds).size !== orderedIds.length;
    const allOwned = orderedIds.every((id) => ownedIds.has(id));
    // 개수 일치 + 전부 내 것 + 중복 없음 = 전체 목록의 순열임이 보장된다.
    if (hasDuplicate || !allOwned || orderedIds.length !== owned.length) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '본인 소유의 전체 카테고리 ID를 누락·중복 없이 보내야 합니다.',
      );
    }

    await categoryRepository.reorder(orderedIds);
  },
};