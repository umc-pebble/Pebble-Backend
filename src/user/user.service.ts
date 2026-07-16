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
    const duplicated = await userRepository.existsByEmailOrPendingEmail(newEmail);
    if (duplicated) {
      throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS);
    await userRepository.setPendingEmailChange(userId, newEmail, sha256(token), expiresAt);
    await sendEmailChangeVerification(newEmail, token);
  },

  async confirmEmailChange(userId: number, token: string) {
    const user = await getUserOrThrow(userId);
    const isValid =
      user.pendingEmail &&
      user.emailChangeTokenHash === sha256(token) &&
      user.emailChangeTokenExpiresAt &&
      user.emailChangeTokenExpiresAt > new Date();

    if (!isValid) {
      throw new AppError('COMMON_INVALID_INPUT', '인증 링크가 만료되었거나 유효하지 않습니다.');
    }

    const updated = await userRepository.confirmEmailChange(userId, user.pendingEmail as string);
    return {
      id: updated.id,
      email: updated.email,
      nickname: updated.nickname,
      uniqueTag: updated.uniqueTag,
    };
  },
};
