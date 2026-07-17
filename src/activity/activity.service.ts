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

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                '유효하지 않은 사용자 ID입니다.',
            );
        }

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

        if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDateString)) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'baseDate는 YYYY-MM-DD 형식이어야 합니다.',
            );
        }

        const endDate = new Date(
            `${baseDateString}T00:00:00+09:00`,
        );
        
        if ( Number.isNaN(endDate.getTime()) || formatDate(endDate) !== baseDateString) {
            throw new AppError(
                'COMMON_INVALID_INPUT',
                'baseDate는 YYYY-MM-DD 형식이어야 합니다.',
            );
        }

        //startDate: endDate-6
        const startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 6);

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
            currentDate.setUTCDate(startDate.getUTCDate() + index);

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