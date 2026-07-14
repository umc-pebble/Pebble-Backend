import { z } from 'zod';

// User 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 컨트롤러/서비스는 여기서 파싱된 타입(z.infer)을 그대로 신뢰한다.

const colorField = z
  .string()
  .max(20)
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, '색상은 hex 코드 형식이어야 합니다.');

export const updateMeSchema = z.object({
  nickname: z.string().max(100).optional(),
  bio: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
});

export const updateSettingsSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK']).optional(),
  notifyTaskDue: z.boolean().optional(),
  activityColor: colorField.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword는 비어 있을 수 없습니다.'),
  newPassword: z.string().min(8, 'newPassword는 8자 이상이어야 합니다.'),
});

export const requestEmailChangeSchema = z.object({
  newEmail: z.string().email('올바른 이메일 형식이 아닙니다.'),
});

export const confirmEmailChangeSchema = z.object({
  token: z.string().min(1, 'token은 비어 있을 수 없습니다.'),
});

export type UpdateMeBody = z.infer<typeof updateMeSchema>;
export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type RequestEmailChangeBody = z.infer<typeof requestEmailChangeSchema>;
export type ConfirmEmailChangeBody = z.infer<typeof confirmEmailChangeSchema>;
