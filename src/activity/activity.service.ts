import { AppError } from "../utils/app-error";
import { activityRepository } from "./activity.repository";

export const activityService = {
    getActivityByUserId: async (
        requesterId: number,
        targetUserId: number,
        baseDate?: string,
    ) => {
        //targetUser 찾기
        const targetUser = await activityRepository.findUserById(targetUserId);

        if(!targetUser){
            throw new AppError(
                'COMMON_NOT_FOUND',
                '사용자를 찾을 수 없습니다.',
            );
        }

        //본인 조회인지 확인
        const isSelf = requesterId === targetUserId;

        if(!isSelf) {
            //친구 조회인지 확인
            const isFriend = await activityRepository.existsAcceptedFollow(
                requesterId,
                targetUserId,
            );

            if(!isFriend) {
                throw new AppError(
                    'COMMON_FORBIDDEN',
                    '친구의 활동 기록만 조회할 수 있습니다.',
                )
            }
        }

        //endDate: baseDate 기준, 입력 받지 않으면 당일
        const endDate = baseDate ? new Date(baseDate) : new Date();
        if (Number.isNaN(endDate.getTime())) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'baseDate 형식이 올바르지 않습니다.',
            );
        }

        //startDate: endDate-6
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);

        //logs 불러오기
        const logs = await activityRepository.findActivityLogsByDateRange(
            targetUserId,
            startDate,
            endDate,
        )

        return logs;
    }
};
