import prisma from "../config/database";

type ActivityLogSummary = {
  date: Date;
  completedTaskCount: number;
};

export const activityRepository = {
    //id, nickname, activityColor 가져오기
    findUserById: async (userId: number) => {
        return prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                nickname: true,
                activityColor: true,
            }
        });
    },

    //친구 관계 확인
    existsAcceptedFollow: async (
        requesterId: number,
        targetUserId: number,
    ) : Promise<boolean> => {
        const follow = await prisma.follow.findFirst({
            where: {
                status: 'ACCEPTED',
                followerId: requesterId,
                followingId: targetUserId,
            },
            select:{
                id: true,
            },
        });
        return follow !== null;
    },

    //7일 logs 조회
    findActivityLogsByDateRange: async(
        userId: number,
        startDate: Date,
        endDate: Date,
    ) : Promise<ActivityLogSummary[]> => {
        const logs = await prisma.activityLog.findMany({
            where:{
                userId,
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            select:{
                date: true,
                completedTaskCount: true,
            },
            orderBy: {
                date: 'asc',
            }
        });

        return logs;
    }
};
