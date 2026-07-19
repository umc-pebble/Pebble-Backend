import { z } from 'zod';

// User 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 컨트롤러/서비스는 여기서 파싱된 타입(z.infer)을 그대로 신뢰한다.

export const updateMeSchema = z.object({
  // 100자 제한은 기능명세서(PLB-003)엔 없는 값이지만, 합의된 ERD의 nickname VarChar(100) 컬럼 폭에서
  // 파생된 기술적 가드다(원시 DB 오류 대신 400을 주기 위함). 커스텀 메시지는 넣지 않는다.
  nickname: z.string().max(100).optional(),
  bio: z.string().nullable().optional(),
  // 실제 파일이 아니라 POST /uploads/image로 먼저 업로드한 뒤 받은 URL을 전달한다.
  profileImageUrl: z.string().max(500).nullable().optional(),
});

// PLB-026 확정 팔레트 (색상군당 대표색 1개, 총 6개): 조약돌·시냇물·새싹·햇살·노을·꽃
export const ACTIVITY_COLOR_PALETTE = [
  '#A3A3A3',
  '#82A0FF',
  '#ABE692',
  '#FFE48B',
  '#FFB67A',
  '#FFB4B4',
] as const;

const colorField = z.enum(ACTIVITY_COLOR_PALETTE, {
  message: `색상은 다음 팔레트 중 하나여야 합니다: ${ACTIVITY_COLOR_PALETTE.join(', ')}`,
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
