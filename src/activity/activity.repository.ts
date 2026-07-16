import prisma from "../config/database";

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
};
