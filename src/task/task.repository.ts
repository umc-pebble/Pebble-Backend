import { DateType, Prisma } from "@prisma/client";
import prisma from "../config/database";

const runWithP2002Retry = async <T>(
    operation: () => Promise<T>,
    maxRetries = 2,
): Promise<T> => {
    for (
        let attempt = 0;
        attempt <= maxRetries;
        attempt += 1
    ) {
        try {
            return await operation();
        } catch (error) {
            const isUniqueConstraintError =
                error instanceof
                    Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002';

            if (
                !isUniqueConstraintError ||
                attempt === maxRetries
            ) {
                throw error;
            }
        }
    }

    throw new Error(
        'ActivityLog 갱신 재시도에 실패했습니다.',
    );
};

export interface CreateTaskData {
  userId: number;
  categoryId?: number | null;
  milestoneId?: number | null;
  name: string;
  dateType: DateType;
  startDate?: Date | null;
  endDate?: Date | null;
  color?: string | null;
  dates?: Date[];
}

export const taskRepository = {
    findCategoryByIdAndUserId: async (
        categoryId: number,
        userId: number,
    ) => {
        return prisma.category.findFirst({
            where: {
                id: categoryId,
                userId,
            },
            select: {
                id: true,
                isHidden: true,
            },
        });
    },

    findMilestoneByIdAndCategoryIdAndUserId: async (
        milestoneId: number,
        categoryId: number,
        userId: number,
    ) => {
        return prisma.milestone.findFirst({
            where: {
                id: milestoneId,
                categoryId,
                category: {
                userId,
                },
            },
            select: {
                id: true,
                categoryId: true,
            },
        });
    },
    
    createTask: async (data: CreateTaskData) => {
        return prisma.task.create({
            data: {
                userId: data.userId,
                categoryId: data.categoryId ?? null,
                milestoneId: data.milestoneId ?? null,
                name: data.name,
                dateType: data.dateType,
                startDate: data.startDate ?? null,
                endDate: data.endDate ?? null,
                color: data.color ?? null,

                taskDates: data.dateType===DateType.MULTIPLE && data.dates ? {
                    create: data.dates.map((date)=>({
                        date,
                    })),
                } : undefined,
            },
            include: {
                taskDates: {
                    orderBy: {
                        date: 'asc',
                    },
                },
            },
        });
    },

    //userId 기준 task 조회 (dateType 확인 위해)
    findTaskByIdAndUserId: async (taskId: number, userId: number) => {
        return prisma.task.findFirst({
            where: {
                id: taskId,
                userId,
            },
            select: {
                id: true,
                userId: true,
                categoryId: true,
                milestoneId: true,
                name: true,
                dateType: true,
                startDate: true,
                endDate: true,
                color: true,
                isCompleted: true,
                completedAt: true,
            },
        });
    },

    // SINGLE/RANGE 태스크 전체 삭제 + 완료된 태스크라면 활동기록 감소
    deleteTaskById: async (
        taskId: number,
        userId: number,
        date: Date | null,
        wasCompleted: boolean,
    ) => {
        return prisma.$transaction(async (tx) => {
            await tx.task.delete({
                where: {
                    id: taskId,
                },
            });

            if (wasCompleted && date) {
                await tx.activityLog.updateMany({
                    where: {
                        userId,
                        date,
                        completedTaskCount: {
                            gt: 0,
                        },
                    },
                    data: {
                        completedTaskCount: {
                            decrement: 1,
                        },
                    },
                });
            }

            return {
                deletedCount: 1,
            };
        });
    },

    //taskDateId가 taskId에 속해 있는지 조회 (THIS_ONLY시)
    findTaskDateByIdAndTaskId: async ( taskDateId: number, taskId: number ) => {
        return prisma.taskDate.findFirst({
            where: {
                id: taskDateId,
                taskId,
            },
            select: {
                id: true,
                taskId: true,
                date: true,
                isCompleted: true,
                completedAt: true,
            },
        });
    },

    // THIS_ONLY 삭제 + 완료된 회차라면 활동기록 감소
    deleteTaskDateById: async (
        taskDateId: number,
        userId: number,
        date: Date | null,
        wasCompleted: boolean,
    ) => {
        return prisma.$transaction(async (tx) => {
            await tx.taskDate.delete({
                where: {
                    id: taskDateId,
                },
            });

            if (wasCompleted && date) {
                await tx.activityLog.updateMany({
                    where: {
                        userId,
                        date,
                        completedTaskCount: {
                            gt: 0,
                        },
                    },
                    data: {
                        completedTaskCount: {
                            decrement: 1,
                        },
                    },
                });
            }

            return {
                deletedCount: 1,
            };
        });
    },

    // ALL 삭제 대상 조회
    findFutureIncompleteTaskDates: async ( taskId: number, today: Date ) => {
        return prisma.taskDate.findMany({
            where: {
                taskId,
                date: {
                    gte: today,
                },
                isCompleted: false,
            },
            select: {
                id: true,
            },
            orderBy: {
                date: 'asc',
            },
        });
    },

    // 미래 미완료 회차 일괄 삭제
    deleteFutureIncompleteTaskDates: async ( taskId: number, today: Date ) => {
        return prisma.taskDate.deleteMany({
            where: {
                taskId,
                date: {
                    gte: today,
                },
                isCompleted: false,
            },
        });
    },

    // SINGLE/RANGE 완료 토글 + 활동기록 갱신
    updateTaskCompletion: async (
        taskId: number,
        userId: number,
        date: Date,
        isCompleted: boolean,
    ) => {
        return runWithP2002Retry(() => prisma.$transaction(async (tx) => {
            const updatedTask =
                await tx.task.update({
                    where: {
                        id: taskId,
                    },
                    data: {
                        isCompleted,
                        completedAt: isCompleted
                            ? new Date()
                            : null,
                    },
                    select: {
                        id: true,
                        isCompleted: true,
                        completedAt: true,
                    },
                });

            if (isCompleted) {
                await tx.activityLog.upsert({
                    where: {
                        userId_date: {
                            userId,
                            date,
                        },
                    },
                    create: {
                        userId,
                        date,
                        completedTaskCount: 1,
                    },
                    update: {
                        completedTaskCount: {
                            increment: 1,
                        },
                    },
                });
            } else {
                await tx.activityLog.updateMany({
                    where: {
                        userId,
                        date,
                        completedTaskCount: {
                            gt: 0,
                        },
                    },
                    data: {
                        completedTaskCount: {
                            decrement: 1,
                        },
                    },
                });
            }

            return updatedTask;
        }),);
    },

    updateTask: async (
        taskId: number,
        data: {
            name?: string;
            startDate?: Date | null;
            endDate?: Date | null;
            color?: string | null;
        },
    ) => {
        return prisma.task.update({
            where: {
                id: taskId,
            },
            data,
            select: {
                id: true,
                userId: true,
                categoryId: true,
                milestoneId: true,
                name: true,
                dateType: true,
                startDate: true,
                endDate: true,
                color: true,
                isCompleted: true,
                completedAt: true,
                displayOrder: true,
            },
        });
    },

    // MULTIPLE 회차 완료 토글 + 활동기록 갱신
    updateTaskDateCompletion: async (
        taskDateId: number,
        userId: number,
        date: Date,
        isCompleted: boolean,
    ) => {
        return runWithP2002Retry(() => prisma.$transaction(async (tx) => {
            const updatedTaskDate =
                await tx.taskDate.update({
                    where: {
                        id: taskDateId,
                    },
                    data: {
                        isCompleted,
                        completedAt: isCompleted
                            ? new Date()
                            : null,
                    },
                    select: {
                        id: true,
                        taskId: true,
                        date: true,
                        isCompleted: true,
                        completedAt: true,
                    },
                });

            if (isCompleted) {
                await tx.activityLog.upsert({
                    where: {
                        userId_date: {
                            userId,
                            date,
                        },
                    },
                    create: {
                        userId,
                        date,
                        completedTaskCount: 1,
                    },
                    update: {
                        completedTaskCount: {
                            increment: 1,
                        },
                    },
                });
            } else {
                await tx.activityLog.updateMany({
                    where: {
                        userId,
                        date,
                        completedTaskCount: {
                            gt: 0,
                        },
                    },
                    data: {
                        completedTaskCount: {
                            decrement: 1,
                        },
                    },
                });
            }

            return updatedTaskDate;
        }),);
    },

    // 월별 전체 태스크 조회
    findTasksByMonth: async (
        userId: number,
        monthStart: Date,
        nextMonthStart: Date,
    ) => {
        return prisma.task.findMany({
            where: {
                userId,

                AND: [
                    {
                        OR: [
                            // 독립 태스크
                            {
                                categoryId: null,
                                milestoneId: null,
                            },
                            // 숨김이 아닌 카테고리의 하위 태스크
                            {
                                category: {
                                    is: {
                                        isHidden: false,
                                    },
                                },
                            },
                        ],
                    },

                    {
                        OR: [
                            // SINGLE: 시작일이 조회 월에 포함
                            {
                                dateType: DateType.SINGLE,
                                startDate: {
                                    gte: monthStart,
                                    lt: nextMonthStart,
                                },
                            },

                            // RANGE: 조회 월과 기간이 하루라도 겹침
                            {
                                dateType: DateType.RANGE,
                                startDate: {
                                    lt: nextMonthStart,
                                },
                                endDate: {
                                    gte: monthStart,
                                },
                            },

                            // MULTIPLE: 조회 월에 해당하는 회차가 하나 이상 존재
                            {
                                dateType: DateType.MULTIPLE,
                                taskDates: {
                                    some: {
                                        date: {
                                            gte: monthStart,
                                            lt: nextMonthStart,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },

            select: {
                id: true,
                userId: true,
                categoryId: true,
                milestoneId: true,
                name: true,
                dateType: true,
                startDate: true,
                endDate: true,
                color: true,
                isCompleted: true,
                completedAt: true,
                displayOrder: true,

                category: {
                    select: {
                        color: true,
                    },
                },

                taskDates: {
                    where: {
                        date: {
                            gte: monthStart,
                            lt: nextMonthStart,
                        },
                    },
                    select: {
                        id: true,
                        date: true,
                        isCompleted: true,
                        completedAt: true,
                        exception: {
                            select: {
                                name: true,
                                color: true,
                            },
                        },
                    },
                    orderBy: {
                        date: 'asc',
                    },
                },
            },

            orderBy: [
                {
                    displayOrder: 'asc',
                },
                {
                    id: 'asc',
                },
            ],
        });
    },

    // 사용자가 소유한 마일스톤 조회
    findMilestoneByIdAndUserId: async (
        milestoneId: number,
        userId: number,
    ) => {
        return prisma.milestone.findFirst({
            where: {
                id: milestoneId,
                category: {
                    userId,
                },
            },
            select: {
                id: true,
            },
        });
    },

    // 특정 마일스톤의 전체 태스크 ID 조회
    findTaskIdsByMilestoneId: async (
        milestoneId: number,
        userId: number,
    ) => {
        return prisma.task.findMany({
            where: {
                milestoneId,
                userId,
            },
            select: {
                id: true,
            },
            orderBy: {
                displayOrder: 'asc',
            },
        });
    },

    findTaskDatesByTaskId: async (
        taskId: number,
    ) => {
        return prisma.taskDate.findMany({
            where: {
                taskId,
            },
            select: {
                id: true,
                taskId: true,
                date: true,
                isCompleted: true,
                completedAt: true,
                exception: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
            },
            orderBy: {
                date: 'asc',
            },
        });
    },

    replaceFutureIncompleteTaskDates: async (
        taskId: number,
        today: Date,
        dates: Date[],
    ) => {
        return prisma.$transaction(async (tx) => {
            await tx.taskDate.deleteMany({
                where: {
                    taskId,
                    date: {
                        gte: today,
                    },
                    isCompleted: false,
                },
            });

            if (dates.length > 0) {
                await tx.taskDate.createMany({
                    data: dates.map((date) => ({
                        taskId,
                        date,
                    })),
                    skipDuplicates: true,
                });
            }

            return tx.taskDate.findMany({
                where: {
                    taskId,
                },
                select: {
                    id: true,
                    taskId: true,
                    date: true,
                    isCompleted: true,
                    completedAt: true,
                    exception: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                        },
                    },
                },
                orderBy: {
                    date: 'asc',
                },
            });
        });
    },

    findTaskExceptionByTaskDateId: async (
        taskDateId: number,
    ) => {
        return prisma.taskException.findUnique({
            where: {
                taskDateId,
            },
            select: {
                id: true,
                taskDateId: true,
                name: true,
                color: true,
            },
        });
    },

    upsertTaskException: async (
        taskDateId: number,
        data: {
            name?: string | null;
            color?: string | null;
        },
    ) => {
        return prisma.taskException.upsert({
            where: {
                taskDateId,
            },
            update: data,
            create: {
                taskDateId,
                name: data.name,
                color: data.color,
            },
            select: {
                id: true,
                taskDateId: true,
                name: true,
                color: true,
            },
        });
    },

    updateMultipleTaskAll: async (
        taskId: number,
        today: Date,
        data: {
            name?: string;
            color?: string | null;
        },
        currentTask: {
            name: string;
            color: string | null;
        },
    ) => {
        return prisma.$transaction(async (tx) => {
            const preservedTaskDates =
                await tx.taskDate.findMany({
                    where: {
                        taskId,
                        OR: [
                            {
                                date: {
                                    lt: today,
                                },
                            },
                            {
                                isCompleted: true,
                            },
                        ],
                    },
                    select: {
                        id: true,
                        exception: {
                            select: {
                                id: true,
                                name: true,
                                color: true,
                            },
                        },
                    },
                });

            for (const taskDate of preservedTaskDates) {
                const preservedName =
                    data.name !== undefined
                        ? taskDate.exception?.name
                            ?? currentTask.name
                        : taskDate.exception?.name;

                const preservedColor =
                    data.color !== undefined
                        ? taskDate.exception?.color
                            ?? currentTask.color
                        : taskDate.exception?.color;

                await tx.taskException.upsert({
                    where: {
                        taskDateId: taskDate.id,
                    },
                    update: {
                        name: preservedName,
                        color: preservedColor,
                    },
                    create: {
                        taskDateId: taskDate.id,
                        name: preservedName,
                        color: preservedColor,
                    },
                });
            }

            if (data.name !== undefined) {
                await tx.taskException.updateMany({
                    where: {
                        taskDate: {
                            taskId,
                            date: {
                                gte: today,
                            },
                            isCompleted: false,
                        },
                    },
                    data: {
                        name: null,
                    },
                });
            }

            if (data.color !== undefined) {
                await tx.taskException.updateMany({
                    where: {
                        taskDate: {
                            taskId,
                            date: {
                                gte: today,
                            },
                            isCompleted: false,
                        },
                    },
                    data: {
                        color: null,
                    },
                });
            }

            return tx.task.update({
                where: {
                    id: taskId,
                },
                data: {
                    name: data.name,
                    color: data.color,
                },
                select: {
                    id: true,
                    userId: true,
                    categoryId: true,
                    milestoneId: true,
                    name: true,
                    dateType: true,
                    startDate: true,
                    endDate: true,
                    color: true,
                    isCompleted: true,
                    completedAt: true,
                    displayOrder: true,
                },
            });
        });
    },

    // 마일스톤 하위 태스크 순서 일괄 변경
    updateTaskDisplayOrders: async (
        orderedIds: number[],
    ) => {
        return prisma.$transaction(
            orderedIds.map((taskId, index) =>
                prisma.task.update({
                    where: {
                        id: taskId,
                    },
                    data: {
                        displayOrder: index + 1,
                    },
                    select: {
                        id: true,
                        displayOrder: true,
                    },
                }),
            ),
        );
    },

    findUserById: async (userId: number) => {
        return prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
            },
        });
    },

    existsAcceptedFollow: async (
        requesterId: number,
        targetUserId: number,
    ): Promise<boolean> => {
        const follow = await prisma.follow.findFirst({
            where: {
                status: 'ACCEPTED',
                OR: [
                    {
                        followerId: requesterId,
                        followingId: targetUserId,
                    },
                    {
                        followerId: targetUserId,
                        followingId: requesterId,
                    },
                ],
            },
            select: {
                id: true,
            },
        });

        return follow !== null;
    },

    // 오늘(KST) 알림 배치용(PLB-038). SINGLE은 startDate가 곧 그 날짜다.
    findSingleDueToday(today: Date) {
        return prisma.task.findMany({
            where: { dateType: 'SINGLE', startDate: today, isCompleted: false },
            select: { id: true, userId: true },
        });
    },

    // 오늘(KST) 알림 배치용(PLB-038). RANGE는 기간에 오늘이 포함되면 매일 알림(이슈 #56, A안 확정).
    findRangeDueToday(today: Date) {
        return prisma.task.findMany({
            where: { dateType: 'RANGE', startDate: { lte: today }, endDate: { gte: today }, isCompleted: false },
            select: { id: true, userId: true },
        });
    },

    // 오늘(KST) 알림 배치용(PLB-038). MULTIPLE 태스크는 본체(Task)에 날짜가 없고 회차마다 TaskDate 자식 row로 관리되므로,
    // 오늘 날짜에 해당하는 TaskDate가 있는지로 판단한다. relatedId는 TaskDate가 아니라 상위
    // Task.id를 쓴다 — FE가 dateType과 무관하게 항상 "태스크" 하나로 이동할 수 있도록 하기 위함.
    // 회차(TaskDate.isCompleted)뿐 아니라 부모 Task.isCompleted도 함께 확인한다 — 둘 중 하나라도
    // 완료 처리됐다면 알림 대상에서 제외해야 하기 때문이다.
    findMultipleDueToday(today: Date) {
        return prisma.taskDate.findMany({
            where: { date: today, isCompleted: false, task: { dateType: 'MULTIPLE', isCompleted: false } },
            select: { task: { select: { id: true, userId: true } } },
        });
    },
};
