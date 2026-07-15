import { z } from 'zod';

// 회원가입 (PLB-001): 이메일·비밀번호(8자 이상) 필수, 닉네임 필수, bio·프로필 이미지는 선택
export const signupSchema = z.object({
  email: z
    .string({ required_error: '이메일을 입력해주세요.' })
    .email('이메일 형식이 올바르지 않습니다.'),
  password: z
    .string({ required_error: '비밀번호를 입력해주세요.' })
    .min(8, '비밀번호는 8자 이상이어야 합니다.'),
  nickname: z
    .string({ required_error: '닉네임을 입력해주세요.' })
    .trim()
    .min(1, '닉네임을 입력해주세요.')
    .max(100, '닉네임은 100자 이하여야 합니다.'),
  bio: z.string().max(500, '소개글은 500자 이하여야 합니다.').optional(),
  profileImageUrl: z.string().url('프로필 이미지 URL 형식이 올바르지 않습니다.').optional(),
});
export type SignupDto = z.infer<typeof signupSchema>;

// 로그인 (PLB-002·047)
export const loginSchema = z.object({
  email: z
    .string({ required_error: '이메일을 입력해주세요.' })
    .email('이메일 형식이 올바르지 않습니다.'),
  password: z.string({ required_error: '비밀번호를 입력해주세요.' }).min(1, '비밀번호를 입력해주세요.'),
});
export type LoginDto = z.infer<typeof loginSchema>;

// 토큰 재발급
export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'refreshToken이 필요합니다.' })
    .min(1, 'refreshToken이 필요합니다.'),
});
export type RefreshDto = z.infer<typeof refreshSchema>;
