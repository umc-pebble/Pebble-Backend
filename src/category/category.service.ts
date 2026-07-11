// Category Service
// 비즈니스 로직 계층. Controller와 Repository 사이에서 도메인 규칙(소유권·기본값 처리)을 담당한다.
// DB 쿼리는 categoryRepository에 위임하고, 규칙 위반 시 AppError를 던진다(포맷은 error.middleware가 통일).

import { AppError } from '../utils/app-error';
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

export const categoryService = {
  // 내 카테고리 목록 (displayOrder 순은 repository가 보장).
  getCategories(userId: number) {
    return categoryRepository.findManyByUserId(userId);
  },

  // 단건 조회 (소유권 검증 포함).
  getCategory(userId: number, categoryId: number) {
    return getOwnedCategoryOrThrow(userId, categoryId);
  },

  // 카테고리 생성.
  async createCategory(userId: number, input: CreateCategoryInput) {
    // 새 카테고리는 목록 맨 뒤에 오도록 현재 개수를 displayOrder로 사용한다.
    // (개수 제한 검사는 생략 — 필요 시 여기에 한 줄 추가)
    const count = await categoryRepository.countByUserId(userId);

    const hasInvites =
      Array.isArray(input.inviteUserIds) && input.inviteUserIds.length > 0;

    const category = await categoryRepository.create({
      userId,
      name: input.name,
      color: input.color,
      imageUrl: input.imageUrl ?? null,
      // 확정값: 기본 비공개(false). 스키마 기본값(true)을 서비스에서 명시적으로 덮는다.
      isPublic: input.isPublic ?? false,
      isCompleted: input.isCompleted ?? false,
      isShared: hasInvites, // 초대가 있으면 공유 카테고리로 생성
      displayOrder: count, // 목록 맨 뒤에 추가
    });

    // TODO(shared 도메인 구현 시): inviteUserIds 처리.
    //   요청자 OWNER 등록 + 팔로잉 관계 검증 후 초대자 PENDING 등록(/categories/{id}/share와 동일 로직).
    //   초대 일부 실패해도 생성은 성공(부분 성공) → 결과를 { category, invites }로 반환.
    // 현재는 카테고리 저장까지만 처리하고 invites는 생략한다.
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

  // 순서 일괄 변경. 넘어온 id가 전부 본인 소유이고 중복이 없어야 한다(아니면 400).
  // 클라이언트는 사이드바에 보이는 전체 카테고리를 화면 순서대로 보낸다(페이지네이션 없음).
  async reorderCategories(userId: number, orderedIds: number[]) {
    const owned = await categoryRepository.findManyByUserId(userId);
    const ownedIds = new Set(owned.map((c) => c.id));

    const hasDuplicate = new Set(orderedIds).size !== orderedIds.length;
    const allOwned = orderedIds.every((id) => ownedIds.has(id));
    if (hasDuplicate || !allOwned) {
      throw new AppError(
        'COMMON_INVALID_INPUT',
        '존재하지 않거나 본인 소유가 아닌 카테고리 ID가 포함되어 있습니다.',
      );
    }

    await categoryRepository.reorder(orderedIds);
  },
};