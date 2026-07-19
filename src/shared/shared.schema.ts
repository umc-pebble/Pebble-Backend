import { z } from 'zod';

// SharedCategory 요청 body 스키마 (라우트의 validateBody 미들웨어에서 사용).
// 컨트롤러/서비스는 여기서 파싱된 타입(z.infer)을 그대로 신뢰한다.

// 초대 대상 하나: nickname 또는 email 중 정확히 하나만 지정 (PLB-048).
const inviteTargetSchema = z
  .object({
    nickname: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((v) => (v.nickname ? 1 : 0) + (v.email ? 1 : 0) === 1, {
    message: '닉네임 또는 이메일을 입력해주세요.',
  });

export const shareCategorySchema = z.object({
  invites: z.array(inviteTargetSchema).min(1, '초대할 친구를 1명 이상 지정해야 합니다.'),
});

export const inviteMemberSchema = inviteTargetSchema;

export const respondInviteSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
});

export type InviteTarget = z.infer<typeof inviteTargetSchema>;
export type ShareCategoryBody = z.infer<typeof shareCategorySchema>;
export type InviteMemberBody = z.infer<typeof inviteMemberSchema>;
export type RespondInviteBody = z.infer<typeof respondInviteSchema>;
