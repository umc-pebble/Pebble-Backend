// User Service
// 비즈니스 로직 계층. 프로필 편집(닉네임 쿨다운)·설정·비밀번호/이메일 변경 규칙 담당.

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { signAccessToken, signRefreshToken, sha256 } from '../utils/jwt';
import { sendEmailChangeVerification } from '../utils/mailer';
import { userRepository } from './user.repository';
import { UpdateMeBody, UpdateSettingsBody, ChangePasswordBody } from './user.schema';

const NICKNAME_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15일 (PLB-003·043)
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1시간
const PASSWORD_SALT_ROUNDS = 10;

// 닉네임 재변경 가능 시각 (lastNicknameChangedAt + 15일). 변경 이력이 없으면 즉시 변경 가능(null).
function computeNicknameChangableAfter(lastNicknameChangedAt: Date | null): Date | null {
  if (!lastNicknameChangedAt) return null;
  return new Date(lastNicknameChangedAt.getTime() + NICKNAME_COOLDOWN_MS);
}

async function getUserOrThrow(userId: number) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('COMMON_UNAUTHORIZED', '유효하지 않은 사용자입니다.');
  }
  return user;
}

export const userService = {
  async getProfile(userId: number) {
    const user = await getUserOrThrow(userId);
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      uniqueTag: user.uniqueTag,
      profileImageUrl: user.profileImageUrl,
      bio: user.bio,
      lastNicknameChangedAt: user.lastNicknameChangedAt,
      nicknameChangableAfter: computeNicknameChangableAfter(user.lastNicknameChangedAt),
      createdAt: user.createdAt,
    };
  },

  // 부분 수정. 닉네임 변경 시에만 15일 쿨다운을 검증한다.
  async updateProfile(userId: number, input: UpdateMeBody) {
    const user = await getUserOrThrow(userId);

    // bio/profileImageUrl은 undefined면 Prisma가 update SET절에서 알아서 제외하므로 별도 가드가 필요 없다.
    const data: Prisma.UserUncheckedUpdateInput = {
      bio: input.bio,
      profileImageUrl: input.profileImageUrl,
    };

    if (input.nickname !== undefined) {
      const changableAfter = computeNicknameChangableAfter(user.lastNicknameChangedAt);
      if (changableAfter && changableAfter > new Date()) {
        throw new AppError('USER_NICKNAME_COOLDOWN', '닉네임은 15일마다 변경할 수 있습니다.');
      }
      data.nickname = input.nickname;
      data.lastNicknameChangedAt = new Date();
    }

    const updated = await userRepository.update(userId, data);
    return {
      id: updated.id,
      nickname: updated.nickname,
      uniqueTag: updated.uniqueTag,
      bio: updated.bio,
      profileImageUrl: updated.profileImageUrl,
      lastNicknameChangedAt: updated.lastNicknameChangedAt,
    };
  },

  async getSettings(userId: number) {
    const user = await getUserOrThrow(userId);
    return {
      theme: user.theme,
      notifyTaskDue: user.notifyTaskDue,
      activityColor: user.activityColor,
      // 소셜 전용 계정(PLB-035)은 password가 NULL — 비밀번호 변경 UI 노출 여부 판단에 사용.
      isSocialOnly: user.password === null,
      isTempPassword: user.isTempPassword,
    };
  },

  async updateSettings(userId: number, input: UpdateSettingsBody) {
    await getUserOrThrow(userId);
    const updated = await userRepository.update(userId, {
      theme: input.theme,
      notifyTaskDue: input.notifyTaskDue,
      activityColor: input.activityColor,
    });
    return {
      theme: updated.theme,
      notifyTaskDue: updated.notifyTaskDue,
      activityColor: updated.activityColor,
    };
  },

  // 성공 시 refreshToken을 새로 발급·저장해 기존 세션(이전 refreshToken)을 함께 무효화한다(PLB-042).
  async changePassword(userId: number, input: ChangePasswordBody) {
    const user = await getUserOrThrow(userId);
    if (!user.password) {
      throw new AppError('AUTH_SOCIAL_ONLY', '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.');
    }

    const matches = await bcrypt.compare(input.currentPassword, user.password);
    if (!matches) {
      throw new AppError('COMMON_INVALID_INPUT', '현재 비밀번호가 올바르지 않습니다.');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    const refreshToken = signRefreshToken(userId);
    await userRepository.updatePassword(userId, passwordHash, sha256(refreshToken));

    return {
      accessToken: signAccessToken(userId),
      refreshToken,
    };
  },

  // 인증 링크 발송까지만 처리한다. 실제 email 컬럼 반영은 confirmEmailChange에서 이루어진다(PLB-042).
  async requestEmailChange(userId: number, newEmail: string) {
    const duplicated = await userRepository.existsByEmailOrPendingEmail(userId, newEmail);
    if (duplicated) {
      throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS);
    try {
      await userRepository.setPendingEmailChange(userId, newEmail, sha256(token), expiresAt);
    } catch (err) {
      // 동시 요청이 중복 체크를 모두 통과한 뒤 pendingEmail의 DB unique 제약에서 충돌하는 경우.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
      }
      throw err;
    }
    await sendEmailChangeVerification(newEmail, token);
  },

  async confirmEmailChange(userId: number, token: string) {
    const user = await getUserOrThrow(userId);
    const tokenHash = sha256(token);
    const isValid =
      user.pendingEmail &&
      user.emailChangeTokenHash === tokenHash &&
      user.emailChangeTokenExpiresAt &&
      user.emailChangeTokenExpiresAt > new Date();

    if (!isValid) {
      throw new AppError('COMMON_INVALID_INPUT', '인증 링크가 만료되었거나 유효하지 않습니다.');
    }

    // pendingEmail·토큰 해시·만료 조건을 where에 포함한 조건부 갱신이므로, 검증 이후 pending 정보가
    // 바뀌는 경쟁 상황이면 count가 0으로 돌아온다.
    let result: Awaited<ReturnType<typeof userRepository.confirmEmailChange>>;
    try {
      result = await userRepository.confirmEmailChange(
        userId,
        user.pendingEmail as string,
        tokenHash,
      );
    } catch (err) {
      // 확정 시점 사이에 pendingEmail이 다른 계정의 email로 선점된 경우 (unique 제약 충돌).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
      }
      throw err;
    }
    if (result.count === 0) {
      throw new AppError('COMMON_INVALID_INPUT', '인증 링크가 만료되었거나 유효하지 않습니다.');
    }

    return {
      id: user.id,
      email: user.pendingEmail as string,
      nickname: user.nickname,
      uniqueTag: user.uniqueTag,
    };
  },
};
