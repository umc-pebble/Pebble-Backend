import { z } from 'zod';

// 이미지 업로드 API가 반환한 URL만 리포트에 저장할 수 있도록 요청 본문을 검증한다.
export const updateReportImageSchema = z.object({
  reportImageUrl: z.string().url().max(500),
});

export type UpdateReportImageBody = z.infer<typeof updateReportImageSchema>;