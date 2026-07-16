import { AppError } from "../utils/app-error";
import { activityRepository } from "./activity.repository";

// 한국 기준 YYYY-MM-DD 문자열
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

//level 계산 함수
const getLevel = (completedTaskCount: number): number => {
  if (completedTaskCount === 0) return 0;
  if (completedTaskCount <= 2) return 1;
  if (completedTaskCount <= 4) return 2;
  return 3;
};

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
                );
            }
        }

        const baseDateString = baseDate ?? formatDate(new Date());

        const endDate = new Date(
            `${baseDateString}T00:00:00+09:00`,
        );
        
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
        );

        const logMap = new Map(
            logs.map((log) => [
                formatDate(log.date),
                log.completedTaskCount,
            ]),
        );

        //활동기록 없는 날 0으로 생성하기
        const filledLogs = Array.from({ length: 7 }, (_, index) => {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + index);

            const dateString = formatDate(currentDate);
            const completedTaskCount = logMap.get(dateString) ?? 0;

            return {
                date: dateString,
                completedTaskCount,
                level: getLevel(completedTaskCount),
            };
        });

        return {
            userId: targetUser.id,
            nickname: targetUser.nickname,
            activityColor: targetUser.activityColor,
            baseDate: formatDate(endDate),
            logs: filledLogs,
        };
    }
};