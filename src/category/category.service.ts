// Category Service
// 비즈니스 로직 계층. Controller와 Repository 사이에서 도메인 규칙(소유권·기본값 처리)을 담당한다.
// DB 쿼리는 categoryRepository에 위임하고, 규칙 위반 시 AppError를 던진다(포맷은 error.middleware가 통일).

import { AppError } from '../utils/app-error';
import { isFriend } from '../follow/follow.service';
import { isAcceptedSharedMember, shareCategoryWithUserIds } from '../shared/shared.service';
import { logger } from '../utils/logger';
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
// PLB-045: 카테고리 삭제·순서변경은 오너(최초 생성자) 전용이라 공유 멤버를 허용하지 않는다.
// (편집은 멤버도 동등하게 가능 — updateCategory는 아래 getAccessibleCategoryOrThrow를 쓴다.)
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

// 조회 + 접근 검증. 없으면 404, 오너도 아니고 초대 수락(ACCEPTED)한 공유 멤버도 아니면 403.
// PLB-045: 카테고리 편집은 오너·멤버가 동등하게 가능. 카테고리 자체 조회 및 하위 마일스톤/태스크
// 생성·조회 판정(milestoneService.getCategory 재사용)에도 쓰인다.
async function getAccessibleCategoryOrThrow(userId: number, categoryId: number) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) {
    throw new AppError('COMMON_NOT_FOUND', '카테고리를 찾을 수 없습니다.');
  }
  if (category.userId === userId) {
    return category;
  }
  if (!(await isAcceptedSharedMember(userId, categoryId))) {
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
  // 본인 소유 카테고리 + 초대를 수락한 공유 카테고리를 함께 반환한다.
  getCategories(userId: number) {
    return categoryRepository.findVisibleByUserId(userId);
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

  // 단건 조회 (접근 검증 포함). 오너뿐 아니라 초대를 수락한 공유 멤버도 조회할 수 있다.
  // milestoneService가 하위 마일스톤 생성/조회/이동 시 이 판정을 그대로 재사용한다.
  getCategory(userId: number, categoryId: number) {
    return getAccessibleCategoryOrThrow(userId, categoryId);
  },

  // 카테고리 생성. inviteUserIds가 있으면 생성과 동시에 공유 카테고리로 전환한다 (PLB-044).
  // 초대는 shareCategory(POST /categories/{id}/share)와 동일하게 all-or-nothing이다 —
  // 대상 중 하나라도 검증에 실패하면 카테고리 생성 자체를 롤백한다(반쪽 성공 상태를 만들지 않는다).
  async createCategory(userId: number, input: CreateCategoryInput) {
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

    if (Array.isArray(input.inviteUserIds) && input.inviteUserIds.length > 0) {
      // shareCategoryWithUserIds가 검증에 실패하면 throw하는데, 카테고리는 이미 생성된 뒤라
      // 그대로 두면 "초대는 실패했는데 카테고리만 남는" 반쪽 상태가 된다. 실패 시 방금 만든
      // 카테고리를 함께 지워서(하위 마일스톤/태스크가 없는 시점이라 CASCADE 걱정 없음)
      // 요청 전체를 all-or-nothing으로 되돌린다.
      //
      // 카테고리 생성과 초대를 완전히 하나의 트랜잭션으로 묶지 않은 절충안이다 — 초대는
      // shared 도메인의 별도 트랜잭션(shareCategoryTransaction)에서 처리되므로, 진짜로
      // 하나로 묶으려면 두 도메인 repository가 같은 tx 클라이언트를 주고받아야 해서
      // 리팩터링 범위가 크다. 대신 실패 시 보상 삭제로 all-or-nothing을 흉내낸다.
      try {
        const members = await shareCategoryWithUserIds(userId, category.id, input.inviteUserIds);
        return { category: { ...category, isShared: true }, members };
      } catch (err) {
        // 보상 삭제 자체가 실패해도(방금 만든 빈 카테고리가 고아로 남을 뿐, 다른 데이터에
        // 영향 없음) 원래 실패 원인(err)을 덮어써서 클라이언트에게 엉뚱한 에러가 가면 안 된다.
        try {
          await categoryRepository.delete(category.id);
        } catch (deleteErr) {
          logger.error('[category] 생성 롤백(카테고리 삭제) 실패', {
            categoryId: category.id,
            deleteErr,
          });
        }
        throw err;
      }
    }

    return { category };
  },

  // 부분 수정 (전달된 필드만 반영). PLB-045: 카테고리 편집은 오너와 ACCEPTED 멤버가 동등하게
  // 할 수 있다(삭제만 오너 전용) — 접근 검증 후 위임.
  async updateCategory(
    userId: number,
    categoryId: number,
    input: UpdateCategoryInput,
  ) {
    await getAccessibleCategoryOrThrow(userId, categoryId);
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