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
    },
};
