import { DateType } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { taskRepository, CreateTaskData, ReplaceTaskData } from './task.repository';
import { CreateTaskBody, ReorderTasksBody, UpdateTaskBody } from './task.schema';
import { isFriend } from '../follow/follow.service';
import { categoryService } from '../category/category.service';

const toDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const toDateString = (date: Date | null): string | null => {
    return date ? date.toISOString().slice(0, 10) : null;
};

const toKstDate = (date: Date): Date => {
    const dateString =
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);

    return toDate(dateString);
};

const parseBaseDate = (baseDate?: string): string => {
    const value = baseDate ??
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppError(
            'COMMON_INVALID_INPUT',
            'baseDate는 YYYY-MM-DD 형식이어야 합니다.',
        );
    }

    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(
        Date.UTC(year, month - 1, day),
    );

    const isValidDate =
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day;

    if (!isValidDate) {
        throw new AppError(
            'COMMON_INVALID_INPUT',
            '유효하지 않은 baseDate입니다.',
        );
    }

    return value;
};

type TaskMutationResult = {
    id: number;
    userId: number;
    categoryId: number | null;
    milestoneId: number | null;
    name: string;
    dateType: DateType;
    startDate: Date | null;
    endDate: Date | null;
    color: string | null;
    isCompleted: boolean;
    completedAt: Date | null;
    displayOrder: number;
    taskDates: Array<{
        id: number;
        date: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        exception?: {
            name: string | null;
            color: string | null;
        } | null;
    }>;
};

const formatTaskMutationResult = (
    task: TaskMutationResult,
    effectiveColor: string | null = task.color,
) => ({
    id: task.id,
    userId: task.userId,
    categoryId: task.categoryId,
    milestoneId: task.milestoneId,
    name: task.name,
    dateType: task.dateType,
    startDate: toDateString(task.startDate),
    endDate: toDateString(task.endDate),
    color: effectiveColor,
    isCompleted: task.isCompleted,
    completedAt: task.completedAt,
    displayOrder: task.displayOrder,
    ...(task.dateType === DateType.MULTIPLE
        ? {
            taskDates: task.taskDates.map((taskDate) => ({
                taskDateId: taskDate.id,
                date: toDateString(taskDate.date),
                isCompleted: taskDate.isCompleted,
                completedAt: taskDate.completedAt,
                name: taskDate.exception?.name ?? task.name,
                color: taskDate.exception?.color ?? effectiveColor,
            })),
        }
        : {}),
});

const sameStringSet = (left: string[], right: string[]) => {
    if (left.length !== right.length) {
        return false;
    }

    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();

    return sortedLeft.every(
        (value, index) => value === sortedRight[index],
    );
};

type AccessibleTask = NonNullable<
    Awaited<
        ReturnType<
            typeof taskRepository.findTaskById
        >
    >
>;

const assertTaskAccess = async (
    userId: number,
    task: AccessibleTask,
) => {
    if (task.categoryId === null) {
        if (task.userId !== userId) {
            throw new AppError(
                'COMMON_FORBIDDEN',
                '해당 태스크에 접근할 권한이 없습니다.',
            );
        }

        return;
    }

    await categoryService.getCategory(
        userId,
        task.categoryId,
    );
};

export const taskService = {
    createTask: async (userId: number, body: CreateTaskBody) => {
        const {categoryId, milestoneId}=body;
        // 1. 마일스톤 생성 가능 여부
        if(categoryId==null && milestoneId!=null){
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '마일스톤 태스크에는 categoryId가 필요합니다.',
            );
        }

        if (categoryId != null && body.color !== undefined) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '하위 태스크에는 color를 지정할 수 없습니다.',
            );
        }

        // 2. 카테고리 / 마일스톤 검증
        if (categoryId != null) {
            await categoryService.getCategory(
                userId,
                categoryId,
            );

            if (milestoneId != null) {
                const milestone =
                    await taskRepository
                        .findMilestoneByIdAndCategoryId(
                            milestoneId,
                            categoryId,
                        );

                if (!milestone) {
                    throw new AppError(
                        'COMMON_INVALID_INPUT',
                        '해당 마일스톤이 존재하지 않거나 선택한 카테고리에 속하지 않습니다.',
                    );
                }
            }
        }

        // 3. 값 생성
        const data: CreateTaskData = {
            userId,
            categoryId: body.categoryId ?? null,
            milestoneId: body.milestoneId ?? null,
            name: body.name,
            dateType: body.dateType,
            startDate: body.startDate ? toDate(body.startDate) : null,
            endDate: body.endDate ? toDate(body.endDate) : null,
            color: categoryId == null ? body.color ?? null : null,
            dates: body.dates?.map(toDate),
        };

        const task = await taskRepository.createTask(data);

        return task;
    },

    updateTask: async (
        userId: number,
        taskId: number,
        body: UpdateTaskBody,
    ) => {
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'taskId는 양의 정수여야 합니다.',
            );
        }

        const task =
            await taskRepository.findTaskById(
                taskId,
            );

        if (!task) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '태스크를 찾을 수 없습니다.',
            );
        }

        await assertTaskAccess(
            userId,
            task,
        );

        const categoryId = body.categoryId;
        const milestoneId = body.milestoneId;

        let categoryColor: string | null = null;

        if (categoryId !== null) {
            const category =
                await categoryService.getCategory(
                    userId,
                    categoryId,
                );

            categoryColor = category.color;

            if (milestoneId !== null) {
                const milestone =
                    await taskRepository
                        .findMilestoneByIdAndCategoryId(
                            milestoneId,
                            categoryId,
                        );

                if (!milestone) {
                    throw new AppError(
                        'COMMON_INVALID_INPUT',
                        '해당 마일스톤이 존재하지 않거나 선택한 카테고리에 속하지 않습니다.',
                    );
                }
            }
        }

        const resolvedColor =
            categoryId === null
                ? body.color !== undefined
                    ? body.color
                    : task.categoryId === null
                        ? task.color
                        : null
                : null;

        const replacementData: ReplaceTaskData = {
            userId: task.userId,
            categoryId,
            milestoneId,
            name: body.name.trim(),
            dateType: body.dateType as DateType,
            startDate:
                body.dateType === DateType.SINGLE ||
                body.dateType === DateType.RANGE
                    ? toDate(body.startDate!)
                    : null,
            endDate:
                body.dateType === DateType.RANGE
                    ? toDate(body.endDate!)
                    : null,
            color: resolvedColor,
            dates:
                body.dateType === DateType.MULTIPLE
                    ? body.dates!.map(toDate)
                    : [],
        };

        const effectiveMutationColor =
            categoryId === null
                ? replacementData.color
                : categoryColor;

        // 날짜 구성이 동일하면 이름/소속만 같은 Task에서 변경
        // 완료 상태, TaskDate ID, displayOrder는 모두 그대로 유지
        const scheduleChanged = (() => {
            if (task.dateType !== replacementData.dateType) {
                return true;
            }

            if (replacementData.dateType === DateType.SINGLE) {
                return (
                    toDateString(task.startDate) !==
                    toDateString(replacementData.startDate)
                );
            }

            if (replacementData.dateType === DateType.RANGE) {
                return (
                    toDateString(task.startDate) !==
                        toDateString(replacementData.startDate) ||
                    toDateString(task.endDate) !==
                        toDateString(replacementData.endDate)
                );
            }

            return !sameStringSet(
                task.taskDates.map((taskDate) =>
                    toDateString(taskDate.date)!,
                ),
                replacementData.dates.map((date) =>
                    toDateString(date)!,
                ),
            );
        })();

        if (!scheduleChanged) {
            const updatedTask =
                await taskRepository.updateTaskMetadata(
                    taskId,
                    {
                        userId,
                        categoryId,
                        milestoneId,
                        name: replacementData.name,
                        color: replacementData.color,
                    },
                );

            return {
                updateMode: 'METADATA_ONLY',
                preservedTaskId: null,
                ...formatTaskMutationResult(
                    updatedTask,
                    effectiveMutationColor,
                ),
            };
        }

        const hasCompletedHistory =
            task.isCompleted ||
            task.taskDates.some(
                (taskDate) => taskDate.isCompleted,
            );

        // 완료 이력이 없다면 부모 Task를 그대로 재사용합니다.
        if (!hasCompletedHistory) {
            const updatedTask =
                await taskRepository.replaceTaskInPlace(
                    taskId,
                    replacementData,
                );

            return {
                updateMode: 'REPLACED_IN_PLACE',
                preservedTaskId: null,
                ...formatTaskMutationResult(
                    updatedTask,
                    effectiveMutationColor,
                ),
            };
        }

        // 기존 MULTIPLE 완료 회차와 새 dates가 하나도 겹치지 않으면
        // 같은 Task.id에서 완료 회차를 보존하고 미완료 회차만 교체
        if (
            task.dateType === DateType.MULTIPLE &&
            replacementData.dateType === DateType.MULTIPLE &&
            !task.isCompleted
        ) {
            const completedDateSet = new Set(
                task.taskDates
                    .filter((taskDate) => taskDate.isCompleted)
                    .map((taskDate) =>
                        toDateString(taskDate.date)!,
                    ),
            );

            // 전체 날짜 집합이 동일한 요청은 위에서 METADATA_ONLY로 끝납니다.
            // 여기서의 중복은 실제 일정 변경 요청에 완료 날짜가 다시 포함된 경우입니다.
            const overlapsCompletedDate =
                replacementData.dates.some((date) =>
                    completedDateSet.has(toDateString(date)!),
                );

            if (!overlapsCompletedDate) {
                const updatedTask =
                    await taskRepository.replaceMultipleKeepingCompleted(
                        taskId,
                        replacementData,
                    );

                return {
                    updateMode: 'KEPT_COMPLETED_DATES',
                    preservedTaskId: null,
                    ...formatTaskMutationResult(
                        updatedTask,
                        effectiveMutationColor,
                    ),
                };
            }
        }

        // 완료 날짜와 새 날짜가 겹치면 기존 완료 기록은 원래 Task에 남기고 요청 일정은 새 Task 그룹으로 생성
        const { preservedTask, createdTask } =
            await taskRepository.splitTaskPreservingCompleted(
                taskId,
                task.dateType,
                replacementData,
            );

        return {
            updateMode: 'CREATED_NEW_TASK_GROUP',
            preservedTaskId: preservedTask.id,
            ...formatTaskMutationResult(
                createdTask,
                effectiveMutationColor,
            ),
        };
    },

    deleteTask: async (
        userId: number,
        taskId: number,
        deleteScope?: string,
        taskDateId?: number,
    ) => {
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'taskId는 양의 정수여야 합니다.',
            );
        }

        if (
        taskDateId !== undefined && (!Number.isInteger(taskDateId) || taskDateId <= 0)) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'taskDateId는 양의 정수여야 합니다.',
            );
        }

        const task =
            await taskRepository.findTaskById(
                taskId,
            );

        if (!task) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '태스크를 찾을 수 없습니다.',
            );
        }

        await assertTaskAccess(
            userId,
            task,
        );

        // SINGLE / RANGE
        if (task.dateType !== DateType.MULTIPLE) {
            if (deleteScope !== undefined) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '다중 태스크가 아닌 경우 deleteScope를 사용할 수 없습니다.',
                );
            }

            const activityDate =
                task.isCompleted && task.completedAt
                    ? toKstDate(task.completedAt)
                    : null;

            return taskRepository.deleteTaskById(
                taskId,
                task.userId,
                activityDate,
                task.isCompleted,
            );
        }

        // MULTIPLE인데 deleteScope 누락 또는 잘못된 값
        if (deleteScope !== 'THIS_ONLY' && deleteScope !== 'ALL') {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '다중 태스크 삭제 시 deleteScope가 필요합니다.',
            );
        }

        // THIS_ONLY 처리
        if (deleteScope === 'THIS_ONLY') {
            if(taskDateId==null) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '이 항목만 삭제하려면 taskDateId가 필요합니다.',
                );
            }

            const taskDate = await taskRepository.findTaskDateByIdAndTaskId(taskDateId, taskId);

            if (!taskDate) {
                throw new AppError(
                    'COMMON_NOT_FOUND',
                    '태스크를 찾을 수 없습니다.',
                );
            }

            const activityDate =
                taskDate.isCompleted && taskDate.completedAt
                    ? toKstDate(taskDate.completedAt)
                    : null;

            await taskRepository.deleteTaskDateById(
                taskDateId,
                task.userId,
                activityDate,
                taskDate.isCompleted,
            );

            return {
                deleteScope: 'THIS_ONLY',
                deletedTaskDateIds: [taskDateId],
                deletedCount: 1,
            };
        }

        // ALL 처리
        if (taskDateId !== undefined) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '전체 삭제 시 taskDateId를 사용할 수 없습니다.',
            );
        }

        const kstTodayString = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());

        const today = toDate(kstTodayString);
        const taskDates = await taskRepository.findFutureIncompleteTaskDates(taskId, today);
        const deletedTaskDateIds = taskDates.map((taskDate) => taskDate.id);

        await taskRepository.deleteFutureIncompleteTaskDates(taskId, today);

        return {
            deleteScope: 'ALL',
            deletedTaskDateIds,
            deletedCount: deletedTaskDateIds.length,
        };
    },

    toggleTaskComplete: async (
        userId: number,
        taskId: number,
        taskDateId?: number,
    ) => {
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'taskId는 양의 정수여야 합니다.',
            );
        }

        if (
            taskDateId !== undefined &&
            (!Number.isInteger(taskDateId) || taskDateId <= 0)
        ) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'taskDateId는 양의 정수여야 합니다.',
            );
        }

        const task =
            await taskRepository.findTaskById(
                taskId,
            );

        if (!task) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '태스크를 찾을 수 없습니다.',
            );
        }

        await assertTaskAccess(
            userId,
            task,
        );

        // MULTIPLE
        if (task.dateType === DateType.MULTIPLE) {
            if (taskDateId == null) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '다중 태스크는 taskDateId가 필요합니다.',
                );
            }

            const taskDate = await taskRepository.findTaskDateByIdAndTaskId(
                taskDateId,
                taskId,
            );

            if (!taskDate) {
                throw new AppError(
                    'COMMON_NOT_FOUND',
                    '태스크를 찾을 수 없습니다.',
                );
            }

            const nextIsCompleted = !taskDate.isCompleted;

            const activityDate = nextIsCompleted
                ? toKstDate(new Date())
                : taskDate.completedAt
                    ? toKstDate(taskDate.completedAt)
                    : null;

            if (!activityDate) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '완료 기록 날짜를 찾을 수 없습니다.',
                );
            }

            const updatedTaskDate =
                await taskRepository.updateTaskDateCompletion(
                    taskDateId,
                    userId,
                    activityDate,
                    nextIsCompleted,
                );

            return {
                taskId: updatedTaskDate.taskId,
                taskDateId: updatedTaskDate.id,
                date: updatedTaskDate.date.toISOString().slice(0, 10),
                isCompleted: updatedTaskDate.isCompleted,
                completedAt: updatedTaskDate.completedAt,
            };
        }

        // SINGLE / RANGE
        if (taskDateId !== undefined) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '다중 태스크가 아닌 경우 taskDateId를 사용할 수 없습니다.',
            );
        }

        const nextIsCompleted = !task.isCompleted;

        const activityDate = nextIsCompleted
            ? toKstDate(new Date())
            : task.completedAt
                ? toKstDate(task.completedAt)
                : null;

        if (!activityDate) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '완료 기록 날짜를 찾을 수 없습니다.',
            );
        }

        const updatedTask =
            await taskRepository.updateTaskCompletion(
                taskId,
                userId,
                activityDate,
                nextIsCompleted,
            );

        return {
            id: updatedTask.id,
            isCompleted: updatedTask.isCompleted,
            completedAt: updatedTask.completedAt,
        };
    },

    getTasks: async (
        userId: number,
        baseDate?: string,
        includeSharedCategories = true,
    ) => {
        const resolvedBaseDate = parseBaseDate(baseDate);
        const [year, month] = resolvedBaseDate.split('-').map(Number);
        const monthStart = new Date(
            Date.UTC(year, month - 1, 1),
        );
        const nextMonthStart = new Date(
            Date.UTC(year, month, 1),
        );

        const acceptedSharedCategoryIds =
            includeSharedCategories
                ? (
                    await taskRepository
                        .findAcceptedSharedCategoryIds(
                            userId,
                        )
                ).map(
                    (membership) =>
                        membership.categoryId,
                )
                : [];

        const tasks =
            await taskRepository.findTasksByMonth(
                userId,
                acceptedSharedCategoryIds,
                monthStart,
                nextMonthStart,
            );

        return {
            tasks: tasks.map((task) => {
                const effectiveColor =
                    task.categoryId === null
                        ? task.color
                        : task.category?.color ?? null;

                return {
                    id: task.id,
                    userId: task.userId,
                    categoryId: task.categoryId,
                    milestoneId: task.milestoneId,
                    name: task.name,
                    dateType: task.dateType,
                    startDate: toDateString(task.startDate),
                    endDate: toDateString(task.endDate),
                    color: effectiveColor,
                    isCompleted: task.isCompleted,
                    completedAt: task.completedAt,
                    displayOrder: task.displayOrder,

                    ...(task.dateType === DateType.MULTIPLE ? {
                            taskDates: task.taskDates.map(
                                (taskDate) => ({
                                    taskDateId: taskDate.id,
                                    date: toDateString(
                                        taskDate.date,
                                    ),
                                    isCompleted:
                                        taskDate.isCompleted,
                                    completedAt:
                                        taskDate.completedAt,
                                    name:
                                        taskDate.exception?.name
                                        ?? task.name,
                                    color:
                                        taskDate.exception?.color
                                        ?? effectiveColor,
                                }),
                        ),
                    } : {}),
                };
            }),
        };
    },

    reorderTasks: async (
        userId: number,
        body: ReorderTasksBody,
    ) => {
        const { milestoneId, orderedIds } = body;

        const milestone =
            await taskRepository.findMilestoneById(
                milestoneId,
            );

        if (!milestone) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '마일스톤을 찾을 수 없습니다.',
            );
        }

        await categoryService.getCategory(
            userId,
            milestone.categoryId,
        );

        // 해당 마일스톤의 실제 전체 공동 태스크 조회
        const milestoneTasks =
            await taskRepository.findTaskIdsByMilestoneId(
                milestoneId,
            );

        const actualIds = milestoneTasks.map((task) => task.id);
        const actualIdSet = new Set(actualIds);

        // 다른 마일스톤 태스크가 포함됐는지 확인
        const containsInvalidTask = orderedIds.some(
            (taskId) => !actualIdSet.has(taskId),
        );

        if (containsInvalidTask) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '다른 마일스톤의 태스크가 포함되어 있습니다.',
            );
        }

        // 일부 태스크를 누락했는지 확인
        if (orderedIds.length !== actualIds.length) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '해당 마일스톤의 모든 태스크 ID를 전달해야 합니다.',
            );
        }

        const updatedTasks =
            await taskRepository.updateTaskDisplayOrders(
                orderedIds,
            );

        return {
            milestoneId,
            tasks: updatedTasks,
        };
    },

    getFriendTasks: async (
        requesterId: number,
        targetUserId: number,
        baseDate?: string,
    ) => {
        if (
            !Number.isInteger(targetUserId) ||
            targetUserId <= 0
        ) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '유효하지 않은 사용자 ID입니다.',
            );
        }

        const targetUser =
            await taskRepository.findUserById(targetUserId);

        if (!targetUser) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '사용자를 찾을 수 없습니다.',
            );
        }

        if (requesterId === targetUserId) {
            throw new AppError(
                'COMMON_FORBIDDEN',
                '본인 태스크는 기존 태스크 조회 API를 이용해 주세요.',
            );
        }

        const areFriends = await isFriend(
            requesterId,
            targetUserId,
        );

        if (!areFriends) {
            throw new AppError(
                'COMMON_FORBIDDEN',
                '친구의 태스크만 조회할 수 있습니다.',
            );
        }

        return taskService.getTasks(
            targetUserId,
            baseDate,
            false,
        );
    },
};