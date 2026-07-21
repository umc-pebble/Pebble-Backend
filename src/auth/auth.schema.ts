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
  // Swagger 문서가 nullable로 안내하므로 null도 허용해야 한다 (미전송 undefined / 명시적 null 모두 OK)
  bio: z.string().max(500, '소개글은 500자 이하여야 합니다.').nullable().optional(),
  profileImageUrl: z
    .string()
    .url('프로필 이미지 URL 형식이 올바르지 않습니다.')
    .nullable()
    .optional(),
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

// 소셜 로그인 (PLB-002) — 프론트가 OAuth 콜백에서 받은 인가코드를 전달한다.
// redirectUri는 인가코드를 발급받을 때 쓴 값과 반드시 같아야 하며, 생략 시 서버 환경변수를 사용한다.
export const socialLoginSchema = z.object({
  code: z
    .string({ required_error: '인가코드가 필요합니다.' })
    .min(1, '인가코드가 필요합니다.'),
  redirectUri: z.string().url('redirectUri 형식이 올바르지 않습니다.').optional(),
});
export type SocialLoginDto = z.infer<typeof socialLoginSchema>;
