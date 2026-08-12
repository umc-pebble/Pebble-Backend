// Category Repository
// DB 접근 계층. 비즈니스 로직/응답 가공 없이 Prisma 쿼리만 담당한다.
// 소유권 판정·개수 제한 등 도메인 규칙은 categoryService가 담당한다.

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

// groupBy(['isCompleted']) 결과에서 개수를 합산한다. onlyCompleted면 완료된 행만 센다.
// 전체와 완료를 각각 세면 쿼리가 두 배가 되므로, 한 번 묶어 읽고 여기서 나눠 쓴다.
function sumGroupedCounts(
  rows: { isCompleted: boolean; _count: { _all: number } }[],
  onlyCompleted = false,
) {
  return rows.reduce(
    (total, row) => (onlyCompleted && !row.isCompleted ? total : total + row._count._all),
    0,
  );
}

export const categoryRepository = {
  // 특정 유저의 카테고리 목록. displayOrder 오름차순 = 화면에 보이는 순서.
  // reorderCategories가 "본인 소유 전체"라는 전제로 재사용하므로 소유 카테고리만 반환한다
  // (공유돼서 초대 수락한 카테고리를 섞으면 reorder의 소유권 검증이 깨진다).
  findManyByUserId(userId: number) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { displayOrder: 'asc' },
    });
  },

  // GET /categories 목록용. 본인 소유 카테고리 + 초대를 수락(ACCEPTED)한 공유 카테고리를 함께 반환한다.
  // findManyByUserId와 달리 reorder 등 "소유"를 전제하는 로직에서는 쓰면 안 된다.
  //
  // 정렬은 본인 소유를 먼저, 공유받은 카테고리를 그 뒤에 둔다. displayOrder는 create가
  // "그 오너의 카테고리 중 최대값 + 1"로 채번하는 오너 기준 순번이라, 남의 카테고리를 한 줄로
  // 섞으면 순번이 겹치고(내 0,1,2 + 오너의 1) 겹친 항목의 순서가 조회할 때마다 달라진다.
  // 순서를 바꿀 수 있는 대상도 본인 소유 카테고리뿐이므로(reorderCategories), 공유받은 항목을
  // 뒤로 모아야 순서 변경 API의 계약과도 어긋나지 않는다.
  // 각 구간 안은 displayOrder 오름차순이고, 그것마저 같으면 id(생성 순)로 갈라 순서를 고정한다.
  //
  // 각 카테고리의 일정 개수를 함께 집계한다. 사이드바가 "이 카테고리에 일정이 아예 없는지"를
  // 판단하는 데 쓰는데, 월별 조회(GET /tasks, GET /milestones)는 필터 결과만 주므로 "이번 달에 없다"와
  // "아예 없다"를 구분할 수 없기 때문이다.
  //
  // 집계 기준이 마일스톤과 태스크에서 다른데, 각각 대응하는 월별 조회가 실제로 반환하는 집합에
  // 맞춘 것이다(기준이 어긋나면 "전체로는 있는데 어느 달에도 안 보이는" 카테고리가 생겨 영구 숨김된다).
  // - milestoneCount: 카테고리 전체. 마일스톤은 userId가 없어 카테고리 접근 권한이 곧 접근 권한이고,
  //   milestoneRepository.findManyByMonth도 같은 범위를 반환한다.
  // - taskCount: 요청자가 만든 것만. 태스크 월별 조회(task.repository.findTasksByMonth)가 `userId`로
  //   거르기 때문이다. 여기서의 userId는 카테고리 오너가 아니라 요청자다.
  //   태스크 도메인이 공유 카테고리를 지원하게 되어 findTasksByMonth의 필터가 넓어지면
  //   이 집계도 반드시 같이 넓혀야 한다. 한쪽만 바뀌면 사이드바에서 카테고리가 조용히 사라진다.
  // - sharedTaskCount: 공유 카테고리에서 다른 멤버가 만든 태스크. 위 이유로 아직 월별 조회에
  //   잡히지 않아 표시 판정에는 넣지 않고, 존재 사실만 별도로 노출한다.
  //
  // 태스크는 관계 카운트(_count)로 전체 개수만 받고, 요청자 몫은 groupBy로 따로 센 뒤 뺀다.
  // _count.select의 키는 관계 이름이라 같은 tasks 관계를 서로 다른 두 조건으로 두 번 셀 수 없다.
  // 카테고리 수와 무관하게 쿼리는 항상 2번이라 N+1이 되지 않는다.
  //
  // 두 집계는 반드시 한 트랜잭션(= 동일 읽기 스냅샷) 안에서 읽어야 한다. 따로 실행하면 그 사이
  // 태스크가 생성·삭제될 때 "전체 개수"와 "내 개수"가 서로 다른 시점을 가리켜,
  // sharedTaskCount(= 전체 - 내 것)가 음수가 되는 등 앞뒤가 맞지 않는 응답이 나갈 수 있다.
  //
  // filters로 조회 범위를 좁힐 수 있다(둘 다 생략하면 기존 동작 그대로).
  // - owned=true: 본인이 오너인 카테고리만. 마이페이지의 "완료한 카테고리"처럼 공유받은 항목을
  //   노출하면 안 되는 화면에서 쓴다. 응답에 userId가 있어 클라이언트가 거를 수도 있지만,
  //   화면마다 필터를 다시 구현하면 빠뜨리기 쉬워 서버에서 보장한다.
  // - owned=false: 반대로 공유받은 카테고리만.
  // - isCompleted: 완료 여부로 거른다. owned와 조합해 "내가 만든 완료 카테고리"를 한 번에 얻는다.
  async findVisibleByUserId(
    userId: number,
    filters: { owned?: boolean; isCompleted?: boolean } = {},
  ) {
    // 접근 범위. owned를 안 주면 소유 + 수락한 공유를 모두 본다.
    const accessScope =
      filters.owned === undefined
        ? { OR: [{ userId }, { members: { some: { userId, status: 'ACCEPTED' as const } } }] }
        : filters.owned
          ? { userId }
          : {
              userId: { not: userId },
              members: { some: { userId, status: 'ACCEPTED' as const } },
            };

    const withCounts = await prisma.$transaction(async (tx) => {
      const categories = await tx.category.findMany({
        where: {
          ...accessScope,
          ...(filters.isCompleted === undefined ? {} : { isCompleted: filters.isCompleted }),
        },
        include: {
          _count: { select: { milestones: true, tasks: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });

      // 카테고리가 없으면 in: [] 로 의미 없는 쿼리를 날리지 않는다.
      const myTaskCounts = new Map<number, number>();
      if (categories.length > 0) {
        const grouped = await tx.task.groupBy({
          by: ['categoryId'],
          where: { categoryId: { in: categories.map((c) => c.id) }, userId },
          _count: { _all: true },
        });
        for (const row of grouped) {
          // by에 넣은 categoryId는 위 where에서 non-null만 걸렀지만 타입상 nullable이다.
          if (row.categoryId !== null) {
            myTaskCounts.set(row.categoryId, row._count._all);
          }
        }
      }

      return categories.map(({ _count, ...category }) => {
        const taskCount = myTaskCounts.get(category.id) ?? 0;
        return {
          ...category,
          milestoneCount: _count.milestones,
          taskCount,
          sharedTaskCount: _count.tasks - taskCount,
        };
      });
    });

    return [
      ...withCounts.filter((category) => category.userId === userId),
      ...withCounts.filter((category) => category.userId !== userId),
    ];
  },

  // 카테고리 상세의 진행률 집계. 태스크만 대상이고 마일스톤은 포함하지 않는다(프론트 정책 확정).
  //
  // 세는 단위는 "화면에서 체크할 수 있는 항목 하나"다.
  // - SINGLE·RANGE 태스크: Task row 1건이 곧 1개이고, isCompleted가 그대로 완료 여부다.
  // - MULTIPLE 태스크: 회차(TaskDate) 1건이 1개이고, Task row 자체는 세지 않는다.
  //   MULTIPLE의 Task.isCompleted는 "모든 회차가 끝났을 때만 true"가 되는 파생값이라
  //   (task.repository의 getTaskCompletionState) 이걸 세면 회차별 집계가 되지 않는다.
  //   TaskDate는 MULTIPLE일 때만 생성되므로(task.repository의 createTask) 두 집계는 겹치지 않고,
  //   dateType으로 갈라두면 같은 태스크를 두 번 세는 일도 없다.
  //
  // 목록의 taskCount와 달리 요청자(userId)로 거르지 않는다. 진행률은 오너와 공유 멤버에게
  // 같은 값이 보여야 해서(프론트 확정) 카테고리에 남아 있는 태스크를 전부 센다.
  // 카테고리 접근 권한은 서비스가 먼저 검증하므로 여기서는 categoryId만 본다.
  //
  // 두 집계는 반드시 한 트랜잭션(= 동일 읽기 스냅샷)에서 읽어야 한다. 따로 실행하면 그 사이
  // 완료 토글이 일어나 완료 개수가 전체 개수를 넘는 값이 나갈 수 있다.
  // 트랜잭션 안의 쿼리는 같은 커넥션에서 순차 실행되므로 병렬로 묶지 않고 차례로 await 한다.
  countTaskProgress(categoryId: number) {
    return prisma.$transaction(async (tx) => {
      const taskRows = await tx.task.groupBy({
        by: ['isCompleted'],
        where: { categoryId, dateType: { not: 'MULTIPLE' } },
        _count: { _all: true },
      });
      const taskDateRows = await tx.taskDate.groupBy({
        by: ['isCompleted'],
        where: { task: { categoryId } },
        _count: { _all: true },
      });

      return {
        taskTotalCount: sumGroupedCounts(taskRows) + sumGroupedCounts(taskDateRows),
        taskCompletedCount:
          sumGroupedCounts(taskRows, true) + sumGroupedCounts(taskDateRows, true),
      };
    });
  },

  // 친구 프로필 조회(PLB-040·#64)용 공개 카테고리 목록. 남의 것이라도 isPublic=true만 노출한다.
  // 정렬은 본인 목록과 동일하게 displayOrder(화면 순서) 오름차순.
  findPublicManyByUserId(userId: number) {
    return prisma.category.findMany({
      where: { userId, isPublic: true },
      orderBy: { displayOrder: 'asc' },
    });
  },

  // 친구 프로필에 함께 노출할 "공유 카테고리" 후보. 대상 유저(친구)가 초대를 수락(ACCEPTED)해
  // 참여 중인 남의 공개 카테고리를 반환한다. 위 findPublicManyByUserId가 대상 유저 소유만
  // 반환하는 것과 짝을 이룬다 — 둘을 합쳐야 "친구가 일정을 쓰고 있는 공개 카테고리 전부"가 된다.
  //
  // 여기서 걸러지지 않는 조건이 하나 있다: 오너가 요청자와 친구인지. 이 카테고리의 오너는
  // 대상 유저가 아니라 제3자이고, isPublic은 그 오너가 자기 팔로워에게 건 공개 설정이다.
  // 친구가 멤버라는 이유만으로 열어주면 오너가 공개한 적 없는 사람에게까지 노출되므로,
  // 서비스가 오너와 요청자의 친구 관계를 확인해 다시 거른다(팔로우 판정을 이 계층에서
  // 다시 구현하지 않기 위해 여기서 하지 않는다 — categoryService의 isFriend 재사용 원칙).
  //
  // 정렬은 findVisibleByUserId의 공유 구간과 같다. displayOrder가 오너 기준 순번이라
  // 오너가 제각각인 목록에서는 겹칠 수 있어, 같으면 id(생성 순)로 갈라 순서를 고정한다.
  findPublicSharedByMemberId(userId: number) {
    return prisma.category.findMany({
      where: {
        userId: { not: userId },
        isPublic: true,
        members: { some: { userId, status: 'ACCEPTED' } },
      },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
  },

  // 유저 존재 확인용(친구 프로필 조회). 없으면 null → 서비스에서 404 판정.
  findUserById(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
  },

  // id로 단건 조회. 없으면 null. "내 것 맞나"(소유권)는 서비스에서 userId를 비교해 판정한다.
  findById(categoryId: number) {
    return prisma.category.findUnique({
      where: { id: categoryId },
    });
  },

  // 생성. displayOrder는 "현재 최대값 + 1"로 목록 맨 뒤에 붙인다.
  // 일반 SELECT는 잠금이 없어 동시 생성 시 같은 max를 읽을 수 있으므로(TOCTOU),
  // FOR UPDATE로 해당 유저의 최대 순번 행을 잠가 채번을 직렬화한다.
  // 잠글 행이 없는 첫 생성 등에서 갭 락 교착(deadlock)이 가능해 짧은 재시도를 둔다.
  // Unchecked 타입: 관계 대신 userId(FK 스칼라)를 직접 넣기 위함.
  async create(data: Omit<Prisma.CategoryUncheckedCreateInput, 'displayOrder'>) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ displayOrder: number }[]>`
            SELECT displayOrder FROM Category WHERE userId = ${data.userId}
            ORDER BY displayOrder DESC LIMIT 1 FOR UPDATE`;
          const next = (rows[0]?.displayOrder ?? -1) + 1;
          return tx.category.create({ data: { ...data, displayOrder: next } });
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        const isDeadlock =
          (e as { code?: string }).code === 'P2034' || /deadlock/i.test(message);
        if (!isDeadlock || attempt >= 3) throw e;
      }
    }
  },

  // 부분 수정. 전달된 필드만 갱신된다(undefined인 필드는 건드리지 않음).
  update(categoryId: number, data: Prisma.CategoryUncheckedUpdateInput) {
    return prisma.category.update({
      where: { id: categoryId },
      data,
    });
  },

  // 삭제. 하위 milestone/task/SharedCategoryMember는 스키마 onDelete: Cascade로 함께 삭제된다.
  delete(categoryId: number) {
    return prisma.category.delete({
      where: { id: categoryId },
    });
  },

  // 순서 일괄 변경. orderedIds에 나열된 순서대로 displayOrder를 0,1,2...로 부여한다.
  // 여러 row 갱신을 한 트랜잭션으로 묶어, 일부만 반영되는 상태를 방지한다.
  reorder(orderedIds: number[]) {
    return prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  },
};