import { AppError } from '../utils/app-error';
import { taskRepository, CreateTaskData } from './task.repository';
import { CreateTaskBody } from './task.schema';

const toDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
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
};