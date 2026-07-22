import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';

import { AppError } from '../utils/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken, sha256 } from '../utils/jwt';

import { authRepository } from './auth.repository';
import { sendTempPasswordEmail } from './auth.mailer';
import { SignupDto, LoginDto } from './auth.schema';

const SALT_ROUNDS = 10;
const TAG_MAX_ATTEMPTS = 20;
const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_RATE_LIMIT_MS = 5 * 60 * 1000; // 동일 이메일 5분 1회 (보안 규칙)

// 임시 비밀번호 발급 시각 기록 — 남의 이메일로 반복 발급해 비밀번호를 계속 리셋시키는 괴롭힘 방지.
// 단일 인스턴스 in-memory라 서버 재시작 시 초기화된다. 현재 배포 규모(단일 서버)에선 충분하며,
// 다중 인스턴스로 확장하면 Redis 등 외부 저장소로 교체해야 한다.
const tempPasswordIssuedAt = new Map<string, number>();

// 임시 비밀번호 생성 — 이메일로 보고 타이핑하는 값이라 헷갈리는 문자(0/O, 1/l/I)는 제외.
// Math.random은 예측 가능하므로 crypto.randomInt를 사용한다.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generateTempPassword = () =>
  Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => TEMP_PASSWORD_CHARS[crypto.randomInt(TEMP_PASSWORD_CHARS.length)],
  ).join('');

// 응답용 공개 필드만 추출 — password·refreshToken은 절대 응답에 포함하지 않는다 (보안 규칙)
const toPublicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  uniqueTag: user.uniqueTag,
});

// 고유태그 0000~9999 랜덤 4자리
const generateTag = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

// Prisma unique 제약 위반(P2002)이 어느 컬럼에서 났는지 판별
const p2002Target = (err: unknown): string | null =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
    ? String(err.meta?.target ?? '')
    : null;

// 로그인 시 토큰 발급 — refresh는 sha256 해시로 저장 (회원가입은 createUserWithRefreshToken 트랜잭션 사용)
const issueInitialTokens = async (userId: number) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await authRepository.updateRefreshToken(userId, sha256(refreshToken));
  return { accessToken, refreshToken };
};

export const authService = {
  // 회원가입 (PLB-001) — 성공 시 가입 즉시 로그인 상태(토큰 발급)
  // 사전 조회는 빠른 경로일 뿐, DB unique 제약(P2002)이 동시 가입의 최후 방어선이다.
  signup: async (dto: SignupDto) => {
    const existing = await authRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    for (let attempt = 0; attempt < TAG_MAX_ATTEMPTS; attempt += 1) {
      const uniqueTag = generateTag();
      if (await authRepository.existsByNicknameTag(dto.nickname, uniqueTag)) {
        continue;
      }
      try {
        // 유저 생성과 토큰 해시 저장이 한 트랜잭션 — 둘 다 성공하거나 둘 다 취소된다 (리뷰 반영)
        const tokens = { accessToken: '', refreshToken: '' };
        const user = await authRepository.createUserWithRefreshToken(
          {
            email: dto.email,
            password: passwordHash,
            nickname: dto.nickname,
            uniqueTag,
            bio: dto.bio,
            profileImageUrl: dto.profileImageUrl,
          },
          (userId) => {
            tokens.accessToken = signAccessToken(userId);
            tokens.refreshToken = signRefreshToken(userId);
            return sha256(tokens.refreshToken);
          },
        );
        return { user: toPublicUser(user), ...tokens };
      } catch (err) {
        const target = p2002Target(err);
        if (target?.includes('email')) {
          throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
        }
        if (target && (target.includes('nickname') || target.includes('uniqueTag'))) {
          continue; // 태그 충돌 — 재발급 후 재시도
        }
        throw err;
      }
    }

    throw new AppError('COMMON_INTERNAL_ERROR', '고유태그 발급에 실패했습니다. 다시 시도해주세요.');
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

    const tokens = await issueInitialTokens(user.id);
    return {
      user: toPublicUser(user),
      ...tokens,
      // 임시 비밀번호 상태면 프론트가 비밀번호 변경 화면으로 유도 (PLB-035, 와프 U005)
      ...(user.isTempPassword ? { mustChangePassword: true } : {}),
    };
  },

  // 토큰 재발급 — refresh 회전을 조건부 갱신(CAS)으로 원자적 처리.
  // 검증 실패/저장 해시 불일치/동시 요청 패배 모두 AUTH_TOKEN_EXPIRED(재로그인 유도).
  refresh: async (refreshToken: string) => {
    let userId: number;
    try {
      userId = verifyRefreshToken(refreshToken).userId;
    } catch {
      throw new AppError('AUTH_TOKEN_EXPIRED', '리프레시 토큰이 만료되었거나 유효하지 않습니다.');
    }

    const accessToken = signAccessToken(userId);
    const newRefreshToken = signRefreshToken(userId);
    const { count } = await authRepository.rotateRefreshToken(
      userId,
      sha256(refreshToken),
      sha256(newRefreshToken),
    );
    if (count === 0) {
      throw new AppError('AUTH_TOKEN_EXPIRED', '리프레시 토큰이 만료되었거나 유효하지 않습니다.');
    }

    return { accessToken, refreshToken: newRefreshToken };
  },

  // 로그아웃 (PLB-005) — 서버 저장 refresh 토큰 파기. userId 누락 검사도 여기서 담당한다.
  logout: async (userId: number | undefined) => {
    if (userId === undefined) {
      throw new AppError('COMMON_UNAUTHORIZED', '인증 정보가 없습니다.');
    }
    await authRepository.updateRefreshToken(userId, null);
  },

  // 임시 비밀번호 발급 (PLB-035·047)
  // 계정 존재 여부 노출 방지: 미가입 이메일·rate limit 초과 모두 정상과 동일한 성공 응답으로
  // 끝난다(발송만 생략). 소셜 전용 계정만 예외적으로 400을 준다 — 여기서 비번을 못 바꾼다는
  // 안내가 UX상 필요해서 문서 계약(AUTH_SOCIAL_ONLY)에 이미 포함된 사항.
  issueTempPassword: async (email: string) => {
    const now = Date.now();
    const issuedAt = tempPasswordIssuedAt.get(email);
    if (issuedAt !== undefined && now - issuedAt < TEMP_PASSWORD_RATE_LIMIT_MS) {
      return;
    }

    const user = await authRepository.findByEmail(email);
    if (!user) {
      return;
    }
    if (!user.password) {
      throw new AppError(
        'AUTH_SOCIAL_ONLY',
        '소셜 로그인 계정입니다. 해당 플랫폼에서 비밀번호를 변경해주세요.',
      );
    }

    const tempPassword = generateTempPassword();
    const tempHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    await authRepository.updatePasswordWithTempFlag(user.id, tempHash, true);

    try {
      await sendTempPasswordEmail(email, tempPassword);
    } catch {
      // 발송 실패 시 이전 비밀번호로 원복 — 메일은 못 받았는데 기존 비번만 못 쓰게 되는 상황 방지
      await authRepository.updatePasswordWithTempFlag(user.id, user.password, user.isTempPassword);
      throw new AppError('COMMON_INTERNAL_ERROR', '메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    // 발송까지 성공한 경우에만 rate limit을 기록한다 (실패한 시도가 쿨다운을 소모하지 않도록)
    tempPasswordIssuedAt.set(email, now);
  },
};
