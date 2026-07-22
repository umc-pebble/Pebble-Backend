import { z } from 'zod';

// 팔로우 요청 (PLB-033)
export const requestFollowSchema = z.object({
  targetUserId: z
    .number({ required_error: '팔로우할 유저를 선택해주세요.', invalid_type_error: 'targetUserId는 숫자여야 합니다.' })
    .int('targetUserId는 정수여야 합니다.')
    .positive('targetUserId는 양수여야 합니다.'),
});
export type RequestFollowDto = z.infer<typeof requestFollowSchema>;

// 목록/검색 공통 페이징 — 쿼리스트링은 문자열로 들어오므로 coerce로 숫자 변환
const offset = z.coerce.number().int().min(0).default(0);
const limit = z.coerce.number().int().min(1).max(50).default(10);

// 유저 검색 (PLB-032) — keyword 필수
export const searchUsersQuerySchema = z.object({
  keyword: z
    .string({ required_error: '검색어를 입력해주세요.' })
    .trim()
    .min(1, '검색어를 입력해주세요.'),
  offset,
  limit,
});
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;

// 팔로우 목록 (PLB-034) — friends(맞팔) / pending(받은 요청) / sent(보낸 요청)
export const followListQuerySchema = z.object({
  type: z.enum(['friends', 'pending', 'sent']).default('friends'),
  keyword: z.string().trim().min(1).optional(),
  offset,
  limit,
});
export type FollowListQuery = z.infer<typeof followListQuerySchema>;
