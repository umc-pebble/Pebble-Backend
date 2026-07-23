import prisma from '../config/database';
import { AppError } from '../utils/app-error';
import { reportRepository } from './report.repository';

// DB의 UTC Date 객체와 리포트의 KST 월·일 경계를 변환할 때 사용하는 오프셋이다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type ReportStats = {
    activityLogs: {
        monthlyCompletedTaskCounts: { month: string; count: number }[];
        totalCompletedTaskCount: number;
        period: { startDate: string; endDate: string };
    };
    topCategory: {
        name: string;
        color: string;
        milestoneCount: number;
        taskCount: number;
        milestones: {
            name: string;
            completedTaskCount: number;
            previewTasks: { name: string; completed: boolean }[];
        }[];
    } | null;
    busiestDay: {
        date: string;
        taskCount: number;
        tasks: {
            categoryName: string | null;
            milestoneName: string | null;
            taskName: string;
            completed: boolean;
            color: string | null;
        }[];
    } | null;
    sharedCategories: {
        friendName: string;
        categoryName: string;
        profileImageUrl: string | null;
    }[];
};

// 주어진 시각을 KST 기준 연·월·일로 분해한다.
const kstParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: value('year'), month: value('month'), day: value('day') };
};

// KST 자정에 해당하는 UTC Date 객체를 만들어 Prisma 날짜 조건에 사용한다.
const kstDate = (year: number, monthIndex: number, day = 1) =>
    new Date(Date.UTC(year, monthIndex, day) - KST_OFFSET_MS);

// 연도 경계를 넘는 monthIndex도 YYYY-MM 키로 정규화한다.
const monthKey = (year: number, monthIndex: number) => {
    const normalized = new Date(Date.UTC(year, monthIndex, 1));
    return `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, '0')}`;
};

// 응답 JSON의 날짜를 KST 기준 YYYY-MM-DD 문자열로 만든다.
const dateKey = (date: Date) => {
    const { year, month, day } = kstParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const reportService = {
    async getLatestReport(userId: number) {
        // 조회 시점에 만료되지 않은 가장 최근 리포트만 API 응답 형태로 변환한다.
        const report = await reportRepository.findLatestAvailableByUserId(userId, new Date());
        if (!report) return null;

        return {
            reportMeta: {
                id: report.id,
                userId: report.userId,
                month: report.month,
                reportImageUrl: report.reportImageUrl,
                expiresAt: report.expiresAt,
                createdAt: report.createdAt,
            },
            ...(report.statsData as unknown as ReportStats),
        };
    },

    async updateReportImage(userId: number, reportId: number, reportImageUrl: string) {
        // 리포트가 없을 때와 다른 사용자의 리포트일 때를 구분해 안전하게 차단한다.
        const report = await reportRepository.findById(reportId);
        if (!report) {
            throw new AppError('COMMON_NOT_FOUND', '리포트를 찾을 수 없습니다.');
        }
        if (report.userId !== userId) {
            throw new AppError('COMMON_FORBIDDEN', '해당 리포트를 수정할 권한이 없습니다.');
        }

        const updated = await reportRepository.updateImageUrl(reportId, reportImageUrl);
        return { reportImageUrl: updated.reportImageUrl };
    },

    async createMonthlyReport(userId: number, userCreatedAt: Date, year: number, monthIndex: number) {
        // 완료 시각을 KST 월 경계로 비교해 대상 월에 완료된 태스크만 집계한다.
        const monthStart = kstDate(year, monthIndex);
        const monthEnd = kstDate(year, monthIndex + 1);
        const completedTasks = await prisma.task.findMany({
            where: { userId, isCompleted: true, completedAt: { gte: monthStart, lt: monthEnd } },
            include: { milestone: { include: { category: true } } },
            orderBy: { completedAt: 'asc' },
        });

        // 누적 완료 수와 공유 카테고리 정보는 대상 월 태스크 조회와 독립적으로 병렬 조회한다.
        const [totalCompletedTaskCount, sharedCategories] = await Promise.all([
            prisma.task.count({ where: { userId, isCompleted: true } }),
            prisma.category.findMany({
                where: {
                    isShared: true,
                    OR: [
                        { userId },
                        { members: { some: { userId, status: 'ACCEPTED' } } },
                    ],
                },
                include: {
                    members: {
                        where: { status: 'ACCEPTED', userId: { not: userId } },
                        include: { user: { select: { nickname: true, profileImageUrl: true } } },
                    },
                },
            }),
        ]);

        // 대상 월을 포함한 최근 3개월의 완료 수를 월별 차트 데이터로 만든다.
        const monthlyCompletedTaskCounts = [-2, -1, 0].map((offset) => {
            const start = kstDate(year, monthIndex + offset);
            const end = kstDate(year, monthIndex + offset + 1);
            return { month: monthKey(year, monthIndex + offset), start, end };
        });
        const counts = await Promise.all(monthlyCompletedTaskCounts.map(({ start, end }) =>
            prisma.task.count({ where: { userId, isCompleted: true, completedAt: { gte: start, lt: end } } }),
        ));

        // 대상 월 완료 태스크를 카테고리별로 묶어 가장 많이 완료한 카테고리를 찾는다.
        const categoryTasks = new Map<number, typeof completedTasks>();
        for (const task of completedTasks) {
            const category = task.milestone?.category;
            if (!category) continue;
            const tasks = categoryTasks.get(category.id) ?? [];
            tasks.push(task);
            categoryTasks.set(category.id, tasks);
        }
        const top = [...categoryTasks.entries()].sort(([, a], [, b]) => b.length - a.length)[0];
        const topCategory = top ? (() => {
            const [, tasks] = top;
            const category = tasks[0].milestone!.category;
            const milestones = new Map<number, typeof tasks>();
            for (const task of tasks) {
                const milestone = task.milestone!;
                const milestoneTasks = milestones.get(milestone.id) ?? [];
                milestoneTasks.push(task);
                milestones.set(milestone.id, milestoneTasks);
            }
            return {
                name: category.name,
                color: category.color,
                milestoneCount: milestones.size,
                taskCount: tasks.length,
                milestones: [...milestones.values()].sort((a, b) => b.length - a.length).map((milestoneTasks) => ({
                    name: milestoneTasks[0].milestone!.name,
                    completedTaskCount: milestoneTasks.length,
                    // milestoneTasks는 completedAt 오름차순으로 쌓였으므로 완료 순서상 앞의 두 태스크만 노출한다.
                    previewTasks: milestoneTasks.slice(0, 2).map((task) => ({
                        name: task.name,
                        completed: task.isCompleted,
                    })),
                })),
            };
        })() : null;

        // 완료일(KST)별 태스크 수가 가장 많은 날과 그 날의 태스크 목록을 만든다.
        const dayTasks = new Map<string, typeof completedTasks>();
        for (const task of completedTasks) {
            const key = dateKey(task.completedAt!);
            const tasks = dayTasks.get(key) ?? [];
            tasks.push(task);
            dayTasks.set(key, tasks);
        }
        const busiest = [...dayTasks.entries()].sort(([, a], [, b]) => b.length - a.length)[0];
        const busiestDay = busiest ? {
            date: busiest[0],
            taskCount: busiest[1].length,
            tasks: busiest[1].map((task) => ({
                // 마일스톤에 속하지 않은 개인 태스크는 존재하지 않는 카테고리명을 만들지 않고 null로 반환한다.
                categoryName: task.milestone ? task.milestone.category.name : null,
                milestoneName: task.milestone?.name ?? null,
                taskName: task.name,
                completed: task.isCompleted,
                color: task.milestone?.category.color ?? task.color,
            })),
        } : null;

        // 조회 API가 그대로 반환할 리포트 통계 JSON을 한 번에 구성한다.
        const statsData: ReportStats = {
            activityLogs: {
                monthlyCompletedTaskCounts: monthlyCompletedTaskCounts.map(({ month }, index) => ({ month, count: counts[index] })),
                totalCompletedTaskCount,
                period: { startDate: dateKey(userCreatedAt), endDate: dateKey(new Date(monthEnd.getTime() - 1)) },
            },
            topCategory,
            busiestDay,
            sharedCategories: sharedCategories.flatMap((category) => category.members.map((member) => ({
                friendName: member.user.nickname,
                categoryName: category.name,
                profileImageUrl: member.user.profileImageUrl,
            }))),
        };

        // 전월 리포트는 다음 달 1일 00:00(KST)에 발행되고, 7일간 조회할 수 있다.
        // 실제 cron 콜백이 몇 ms 늦게 실행되거나 재기동 보정으로 실행되어도
        // 리포트의 기준 생성 시각은 항상 월간 발행 시각으로 유지한다.
        const createdAt = kstDate(year, monthIndex + 1);
        const expiresAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
        return reportRepository.upsert(userId, monthKey(year, monthIndex), statsData, expiresAt, createdAt);
    },

    // 알림 생성 시 reportId를 사용하기 위해 결과를 반환하게 수정함.
    async createPreviousMonthReports() {
        // 배치 실행 시점의 KST 기준 전월을 모든 사용자에 대해 생성한다.
        const now = kstParts(new Date());
        const users = await reportRepository.findUsers();

        return Promise.all(
            users.map((user) =>
                this.createMonthlyReport(
                    user.id,
                    user.createdAt,
                    now.year,
                    now.month - 2,
                ),
            ),
        );
    },
};
