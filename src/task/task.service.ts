import { DateType } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { taskRepository, CreateTaskData } from './task.repository';
import { CreateTaskBody } from './task.schema';

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

    getIndependentTasks: async (
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
            await taskRepository.findIndependentTasksByMonth(
                userId,
                monthStart,
                nextMonthStart,
            );

        return {
            tasks: tasks.map((task) => ({
                id: task.id,
                userId: task.userId,
                categoryId: task.categoryId,
                milestoneId: task.milestoneId,
                name: task.name,
                dateType: task.dateType,
                startDate: toDateString(task.startDate),
                endDate: toDateString(task.endDate),
                color: task.color,
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
                                name: task.name,
                                color: task.color,
                            }),
                        ),
                    } : {}),
            })),
        };
    },
};