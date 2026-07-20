import { DateType } from "@prisma/client";
import prisma from "../config/database";

export interface CreateTaskData {
  userId: number;
  categoryId?: number | null;
  milestoneId?: number | null;
  name: string;
  dateType: DateType;
  startDate?: Date | null;
  endDate?: Date | null;
  color?: string | null;
  dates?: Date[];
}

export const taskRepository = {
    createTask: async (data: CreateTaskData) => {
        return prisma.task.create({
            data: {
                userId: data.userId,
                categoryId: data.categoryId ?? null,
                milestoneId: data.milestoneId ?? null,
                name: data.name,
                dateType: data.dateType,
                startDate: data.startDate ?? null,
                endDate: data.endDate ?? null,
                color: data.color ?? null,

                taskDates: data.dateType===DateType.MULTIPLE && data.dates ? {
                    create: data.dates.map((date)=>({
                        date,
                    })),
                } : undefined,
            },
            include: {
                taskDates: {
                    orderBy: {
                        date: 'asc',
                    },
                },
            },
        });
    }
};