import bcrypt from 'bcrypt';
import { User } from '@prisma/client';

import { AppError } from '../utils/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken, sha256 } from '../utils/jwt';

import { authRepository } from './auth.repository';
import { SignupDto, LoginDto } from './auth.schema';

const SALT_ROUNDS = 10;
const TAG_MAX_ATTEMPTS = 20;

// 응답용 공개 필드만 추출 — password·refreshToken은 절대 응답에 포함하지 않는다 (보안 규칙)
const toPublicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  uniqueTag: user.uniqueTag,
});

// 토큰 발급 + refresh는 sha256 해시로 저장 (회전: 기존 해시를 덮어써 이전 refresh 무효화)
const issueTokens = async (userId: number) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await authRepository.updateRefreshToken(userId, sha256(refreshToken));
  return { accessToken, refreshToken };
};

// 고유태그 0000~9999 랜덤 발급, 닉네임#태그 조합 충돌 시 재시도 (PLB-003)
const issueUniqueTag = async (nickname: string) => {
  for (let attempt = 0; attempt < TAG_MAX_ATTEMPTS; attempt += 1) {
    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    if (!(await authRepository.existsByNicknameTag(nickname, tag))) {
      return tag;
    }
  }
  throw new AppError('COMMON_INTERNAL_ERROR', '고유태그 발급에 실패했습니다. 다시 시도해주세요.');
};

export const authService = {
  // 회원가입 (PLB-001) — 성공 시 가입 즉시 로그인 상태(토큰 발급)
  signup: async (dto: SignupDto) => {
    const existing = await authRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const uniqueTag = await issueUniqueTag(dto.nickname);

    const user = await authRepository.createUser({
      email: dto.email,
      password: passwordHash,
      nickname: dto.nickname,
      uniqueTag,
      bio: dto.bio,
      profileImageUrl: dto.profileImageUrl,
    });

    const tokens = await issueTokens(user.id);
    return { user: toPublicUser(user), ...tokens };
  },

  // 로그인 (PLB-002·047) — 유저 없음/비밀번호 불일치/소셜 전용 계정 모두 동일 메시지 (계정 존재 노출 방지)
  login: async (dto: LoginDto) => {
    const user = await authRepository.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new AppError('AUTH_INVALID_CREDENTIAL', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const matched = await bcrypt.compare(dto.password, user.password);
    if (!matched) {
      throw new AppError('AUTH_INVALID_CREDENTIAL', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const tokens = await issueTokens(user.id);
    return {
      user: toPublicUser(user),
      ...tokens,
      // 임시 비밀번호 상태면 프론트가 비밀번호 변경 화면으로 유도 (PLB-035, 와프 U005)
      ...(user.isTempPassword ? { mustChangePassword: true } : {}),
    };
  },

  // 토큰 재발급 — refresh 회전: 검증 실패/저장 해시 불일치 모두 AUTH_TOKEN_EXPIRED(재로그인 유도)
  refresh: async (refreshToken: string) => {
    let userId: number;
    try {
      userId = verifyRefreshToken(refreshToken).userId;
    } catch {
      throw new AppError('AUTH_TOKEN_EXPIRED', '리프레시 토큰이 만료되었거나 유효하지 않습니다.');
    }

    const user = await authRepository.findById(userId);
    if (!user || !user.refreshToken || user.refreshToken !== sha256(refreshToken)) {
      throw new AppError('AUTH_TOKEN_EXPIRED', '리프레시 토큰이 만료되었거나 유효하지 않습니다.');
    }

    return issueTokens(user.id);
  },

  // 로그아웃 (PLB-005) — 서버 저장 refresh 토큰 파기
  logout: async (userId: number) => {
    await authRepository.updateRefreshToken(userId, null);
  },
};
