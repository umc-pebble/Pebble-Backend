import { DateType } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { taskRepository, CreateTaskData } from './task.repository';
import { CreateTaskBody, ReorderTasksBody, UpdateTaskBody } from './task.schema';

const toDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const toDateString = (date: Date | null): string | null => {
    return date ? date.toISOString().slice(0, 10) : null;
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
        if(categoryId!=null) {
            const category= await taskRepository.findCategoryByIdAndUserId(categoryId,userId);
            if(!category){
                throw new AppError(
                    'COMMON_NOT_FOUND',
                    '카테고리를 찾을 수 없습니다.',
                );
            }
        }

        if (milestoneId != null) {
            const milestone = await taskRepository.findMilestoneByIdAndCategoryIdAndUserId( milestoneId, categoryId!, userId);

            if (!milestone) {
                throw new AppError(
                'COMMON_INVALID_INPUT',
                '해당 마일스톤이 존재하지 않거나 선택한 카테고리에 속하지 않습니다.',
                );
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
            await taskRepository.findTaskByIdAndUserId(
                taskId,
                userId,
            );

        if (!task) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '태스크를 찾을 수 없습니다.',
            );
        }

        // 하위 태스크는 카테고리 색상을 상속하므로 color 수정 불가
        if (
            task.categoryId !== null &&
            body.color !== undefined
        ) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '하위 태스크에는 color를 지정할 수 없습니다.',
            );
        }

        // SINGLE
        if (task.dateType === DateType.SINGLE) {
            if (
                body.dates !== undefined ||
                body.editScope !== undefined ||
                body.taskDateId !== undefined
            ) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '일반 태스크에는 dates, editScope, taskDateId를 사용할 수 없습니다.',
                );
            }

            if (body.endDate !== undefined && body.endDate !== null) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    'SINGLE에는 endDate를 지정할 수 없습니다.',
                );
            }

            const startDate =
                body.startDate !== undefined
                    ? body.startDate
                    : toDateString(task.startDate);

            if (!startDate) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    'SINGLE에는 startDate가 필요합니다.',
                );
            }

            const updatedTask =
                await taskRepository.updateTask(
                    taskId,
                    {
                        ...(body.name !== undefined
                            ? {
                                name: body.name.trim(),
                            }
                            : {}),
                        ...(body.startDate !== undefined
                            ? {
                                startDate: toDate(startDate),
                            }
                            : {}),
                        ...(body.color !== undefined
                            ? {
                                color: body.color,
                            }
                            : {}),
                    },
                );

            return {
                id: updatedTask.id,
                userId: updatedTask.userId,
                categoryId: updatedTask.categoryId,
                milestoneId: updatedTask.milestoneId,
                name: updatedTask.name,
                dateType: updatedTask.dateType,
                startDate: toDateString(updatedTask.startDate),
                endDate: null,
                color: updatedTask.color,
                isCompleted: updatedTask.isCompleted,
                completedAt: updatedTask.completedAt,
                displayOrder: updatedTask.displayOrder,
            };
        }

        // RANGE
        if (task.dateType === DateType.RANGE) {
            if (
                body.dates !== undefined ||
                body.editScope !== undefined ||
                body.taskDateId !== undefined
            ) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '기간 태스크에는 dates, editScope, taskDateId를 사용할 수 없습니다.',
                );
            }

            const startDate =
                body.startDate !== undefined
                    ? body.startDate
                    : toDateString(task.startDate);

            const endDate =
                body.endDate !== undefined
                    ? body.endDate
                    : toDateString(task.endDate);

            if (!startDate) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    'RANGE에는 startDate가 필요합니다.',
                );
            }

            if (!endDate) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    'RANGE에는 endDate가 필요합니다.',
                );
            }

            if (endDate < startDate) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '종료일은 시작일 이후여야 합니다.',
                );
            }

            const updatedTask =
                await taskRepository.updateTask(
                    taskId,
                    {
                        ...(body.name !== undefined
                            ? {
                                name: body.name.trim(),
                            }
                            : {}),
                        ...(body.startDate !== undefined
                            ? {
                                startDate: toDate(startDate),
                            }
                            : {}),
                        ...(body.endDate !== undefined
                            ? {
                                endDate: toDate(endDate),
                            }
                            : {}),
                        ...(body.color !== undefined
                            ? {
                                color: body.color,
                            }
                            : {}),
                    },
                );

            return {
                id: updatedTask.id,
                userId: updatedTask.userId,
                categoryId: updatedTask.categoryId,
                milestoneId: updatedTask.milestoneId,
                name: updatedTask.name,
                dateType: updatedTask.dateType,
                startDate: toDateString(updatedTask.startDate),
                endDate: toDateString(updatedTask.endDate),
                color: updatedTask.color,
                isCompleted: updatedTask.isCompleted,
                completedAt: updatedTask.completedAt,
                displayOrder: updatedTask.displayOrder,
            };
        }

        // MULTIPLE
        if (
            body.startDate !== undefined ||
            body.endDate !== undefined
        ) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'MULTIPLE에는 startDate와 endDate를 지정할 수 없습니다.',
            );
        }

        const kstTodayString =
            new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date());

        const today = toDate(kstTodayString);

        // MULTIPLE 날짜 배열 수정
        if (body.dates !== undefined) {
            if (
                body.editScope !== undefined ||
                body.taskDateId !== undefined
            ) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '다중 날짜 수정에는 editScope와 taskDateId를 사용할 수 없습니다.',
                );
            }

            if (!body.dates || body.dates.length === 0) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    'MULTIPLE에는 하나 이상의 dates가 필요합니다.',
                );
            }

            const requestedDates = body.dates.map(toDate);

            if (requestedDates.some((date) => date < today)) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '다중 태스크의 날짜는 오늘 이후만 수정할 수 있습니다.',
                );
            }

            const updatedTaskDates =
                await taskRepository.replaceFutureIncompleteTaskDates(
                    taskId,
                    today,
                    requestedDates,
                );

            return {
                id: task.id,
                dateType: task.dateType,
                taskDates: updatedTaskDates.map(
                    (taskDate) => ({
                        taskDateId: taskDate.id,
                        date: toDateString(taskDate.date),
                        isCompleted: taskDate.isCompleted,
                        completedAt: taskDate.completedAt,
                        name:
                            taskDate.exception?.name
                            ?? task.name,
                        color:
                            taskDate.exception?.color
                            ?? task.color,
                    }),
                ),
            };
        }

        const modifiesNameOrColor =
            body.name !== undefined ||
            body.color !== undefined;

        if (!modifiesNameOrColor) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '수정할 값을 하나 이상 입력해야 합니다.',
            );
        }

        if (
            body.editScope !== 'THIS_ONLY' &&
            body.editScope !== 'ALL'
        ) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '다중 태스크의 이름/색상 수정 시 editScope가 필요합니다.',
            );
        }

        // MULTIPLE - 이 항목만 수정
        if (body.editScope === 'THIS_ONLY') {
            if (body.taskDateId == null) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '이 항목만 수정하려면 taskDateId가 필요합니다.',
                );
            }

            const taskDate =
                await taskRepository.findTaskDateByIdAndTaskId(
                    body.taskDateId,
                    taskId,
                );

            if (!taskDate) {
                throw new AppError(
                    'COMMON_NOT_FOUND',
                    '태스크 회차를 찾을 수 없습니다.',
                );
            }

            const existingException =
                await taskRepository.findTaskExceptionByTaskDateId(
                    body.taskDateId,
                );

            const exception =
                await taskRepository.upsertTaskException(
                    body.taskDateId,
                    {
                        ...(body.name !== undefined
                            ? {
                                name: body.name.trim(),
                            }
                            : {
                                name:
                                    existingException?.name
                                    ?? null,
                            }),
                        ...(body.color !== undefined
                            ? {
                                color: body.color,
                            }
                            : {
                                color:
                                    existingException?.color
                                    ?? null,
                            }),
                    },
                );

            return {
                editScope: 'THIS_ONLY',
                taskId,
                taskDateId: taskDate.id,
                date: toDateString(taskDate.date),
                name: exception.name ?? task.name,
                color: exception.color ?? task.color,
                isCompleted: taskDate.isCompleted,
                completedAt: taskDate.completedAt,
            };
        }

        // MULTIPLE - 전체 수정
        if (body.taskDateId !== undefined) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '전체 수정에는 taskDateId를 지정할 수 없습니다.',
            );
        }

        const updatedTask =
            await taskRepository.updateMultipleTaskAll(
                taskId,
                today,
                {
                    ...(body.name !== undefined
                        ? {
                            name: body.name.trim(),
                        }
                        : {}),
                    ...(body.color !== undefined
                        ? {
                            color: body.color,
                        }
                        : {}),
                },
                {
                    name: task.name,
                    color: task.color,
                },
            );

        return {
            editScope: 'ALL',
            id: updatedTask.id,
            userId: updatedTask.userId,
            categoryId: updatedTask.categoryId,
            milestoneId: updatedTask.milestoneId,
            name: updatedTask.name,
            dateType: updatedTask.dateType,
            startDate: null,
            endDate: null,
            color: updatedTask.color,
            isCompleted: updatedTask.isCompleted,
            completedAt: updatedTask.completedAt,
            displayOrder: updatedTask.displayOrder,
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

        const task = await taskRepository.findTaskByIdAndUserId( taskId, userId );

        if (!task) {
            throw new AppError(
            'COMMON_NOT_FOUND',
            '태스크를 찾을 수 없습니다.',
            );
        }

        // SINGLE / RANGE
        if (task.dateType !== DateType.MULTIPLE) {
            if (deleteScope !== undefined) {
                throw new AppError(
                    'COMMON_INVALID_INPUT',
                    '다중 태스크가 아닌 경우 deleteScope를 사용할 수 없습니다.',
                );
            }

            await taskRepository.deleteTaskById(taskId);

            return {
                deletedCount: 1,
            };
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

            await taskRepository.deleteTaskDateById(taskDateId);

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

        const task = await taskRepository.findTaskByIdAndUserId(
            taskId,
            userId,
        );

        if (!task) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '태스크를 찾을 수 없습니다.',
            );
        }

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

            const updatedTaskDate = await taskRepository.updateTaskDateCompletion(
                taskDateId,
                !taskDate.isCompleted,
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

        const updatedTask =
            await taskRepository.updateTaskCompletion(
                taskId,
                !task.isCompleted,
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
    ) => {
        const resolvedBaseDate = parseBaseDate(baseDate);
        const [year, month] = resolvedBaseDate.split('-').map(Number);
        const monthStart = new Date(
            Date.UTC(year, month - 1, 1),
        );
        const nextMonthStart = new Date(
            Date.UTC(year, month, 1),
        );

        const tasks =
            await taskRepository.findTasksByMonth(
                userId,
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

        // 마일스톤이 사용자의 것인지 확인
        const milestone =
            await taskRepository.findMilestoneByIdAndUserId( milestoneId, userId );

        if (!milestone) {
            throw new AppError(
                'COMMON_NOT_FOUND',
                '마일스톤을 찾을 수 없습니다.',
            );
        }

        // 해당 마일스톤의 실제 전체 태스크 조회
        const milestoneTasks =
            await taskRepository.findTaskIdsByMilestoneId(
                milestoneId,
                userId,
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

        const isFriend =
            await taskRepository.existsAcceptedFollow(
                requesterId,
                targetUserId,
            );

        if (!isFriend) {
            throw new AppError(
                'COMMON_FORBIDDEN',
                '친구의 태스크만 조회할 수 있습니다.',
            );
        }

        return taskService.getTasks(
            targetUserId,
            baseDate,
        );
    },
};