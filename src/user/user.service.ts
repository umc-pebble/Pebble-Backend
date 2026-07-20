// User Service
// 비즈니스 로직 계층. 프로필 편집(닉네임 쿨다운)·설정·비밀번호/이메일 변경 규칙 담당.

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { signAccessToken, signRefreshToken, sha256 } from '../utils/jwt';
import { sendEmailChangeVerification } from '../utils/mailer';
import { logger } from '../utils/logger';
import { uploadService } from '../upload/upload.service';
import { userRepository } from './user.repository';
import { UpdateMeBody, UpdateSettingsBody, ChangePasswordBody } from './user.schema';

const NICKNAME_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15일 (PLB-003·043)
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1시간
const EMAIL_CHANGE_COOLDOWN_MS = 60 * 1000; // 재전송 쿨다운 1분
const EMAIL_CHANGE_WINDOW_MS = 60 * 60 * 1000; // 상한 계산 윈도우 1시간
const EMAIL_CHANGE_MAX_PER_WINDOW = 5; // 윈도우당 최대 요청 수 (메일 폭탄 방지)
const PASSWORD_SALT_ROUNDS = 10;
const UNIQUE_TAG_MAX_ATTEMPTS = 20;

// 닉네임 재변경 가능 시각 (lastNicknameChangedAt + 15일). 변경 이력이 없으면 즉시 변경 가능(null).
function computeNicknameChangeableAfter(lastNicknameChangedAt: Date | null): Date | null {
  if (!lastNicknameChangedAt) return null;
  return new Date(lastNicknameChangedAt.getTime() + NICKNAME_COOLDOWN_MS);
}

// 고유태그 0000~9999 랜덤 4자리. auth.service.ts의 회원가입 태그 생성과 동일한 형식이지만,
// 도메인 분리를 위해 auth 코드를 가져다 쓰지 않고 이 파일 안에 독립적으로 둔다.
function generateUniqueTag(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
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
      nicknameChangeableAfter: computeNicknameChangeableAfter(user.lastNicknameChangedAt),
      createdAt: user.createdAt,
    };
  },

  // 부분 수정. 닉네임 변경 시에만 15일 쿨다운을 검증한다.
  async updateProfile(userId: number, input: UpdateMeBody) {
    const user = await getUserOrThrow(userId);

    // 타인의 업로드 URL(같은 버킷)을 profileImageUrl에 넣고 나중에 교체/삭제해 그 파일이
    // 지워지는 것을 막기 위해, 본인이 업로드한 파일인지 먼저 검증한다.
    if (input.profileImageUrl) {
      uploadService.assertOwnedImage(input.profileImageUrl, userId);
    }

    // bio/profileImageUrl은 undefined면 Prisma가 update SET절에서 알아서 제외하므로 별도 가드가 필요 없다.
    const data: Prisma.UserUncheckedUpdateInput = {
      bio: input.bio,
      profileImageUrl: input.profileImageUrl,
    };

    if (input.nickname !== undefined && input.nickname !== user.nickname) {
      const changeableAfter = computeNicknameChangeableAfter(user.lastNicknameChangedAt);
      if (changeableAfter && changeableAfter > new Date()) {
        throw new AppError('USER_NICKNAME_COOLDOWN', '닉네임은 15일마다 변경할 수 있습니다.');
      }
      data.nickname = input.nickname;
      data.lastNicknameChangedAt = new Date();

      // 닉네임 중복은 설계상 허용되며 uniqueTag로만 구분한다(PR #27 리뷰 스레드, FE/기획 확인 완료).
      // 그래서 겹치면 변경을 막는 대신, 디스코드식으로 안 쓰이는 uniqueTag를 새로 찾아 재발급한다.
      if (await userRepository.existsByNicknameTag(input.nickname, user.uniqueTag, userId)) {
        let reissuedTag: string | null = null;
        for (let attempt = 0; attempt < UNIQUE_TAG_MAX_ATTEMPTS; attempt += 1) {
          const candidate = generateUniqueTag();
          if (!(await userRepository.existsByNicknameTag(input.nickname, candidate, userId))) {
            reissuedTag = candidate;
            break;
          }
        }
        if (!reissuedTag) {
          throw new AppError(
            'COMMON_INTERNAL_ERROR',
            '닉네임 태그 재발급에 실패했습니다. 잠시 후 다시 시도해주세요.',
          );
        }
        data.uniqueTag = reissuedTag;
      }
    }

    // 닉네임을 바꿀 때만 쿨다운 조건을 where에 실어 원자적으로 체크한다. 동시 요청 두 개가
    // 위의 changeableAfter 검증을 둘 다 통과해도, 실제 반영 시점엔 하나만 성공하게 된다.
    const cooldownBoundary =
      data.nickname !== undefined ? new Date(Date.now() - NICKNAME_COOLDOWN_MS) : undefined;

    let result;
    try {
      result = await userRepository.updateProfile(userId, data, cooldownBoundary);
    } catch (err) {
      // 재발급/확인 시점 사이에 다른 요청이 동일한 (nickname, uniqueTag)를 선점한 경합 상황.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('COMMON_INTERNAL_ERROR', '닉네임 변경에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (err instanceof AppError) throw err;
      throw new AppError('COMMON_INTERNAL_ERROR', '닉네임 변경 중 오류가 발생했습니다.');
    }
    if (result.count === 0) {
      // cooldownBoundary가 있었는데 count===0이면 그사이 쿨다운이 다시 걸린 경합 상황.
      // cooldownBoundary가 없는데도 0이면(닉네임 미변경) 그사이 계정이 삭제된 경우다.
      if (cooldownBoundary) {
        throw new AppError('USER_NICKNAME_COOLDOWN', '닉네임은 15일마다 변경할 수 있습니다.');
      }
      throw new AppError('COMMON_UNAUTHORIZED', '유효하지 않은 사용자입니다.');
    }

    // profileImageUrl이 실제로 교체/제거된 경우에만, DB 반영이 끝난 뒤 변경 전 파일을 정리한다.
    // 이전 값이 null이면 PLB-004 기본 이미지라 Storage에 지울 파일이 없다.
    if (
      input.profileImageUrl !== undefined &&
      input.profileImageUrl !== user.profileImageUrl &&
      user.profileImageUrl
    ) {
      await uploadService.deleteImage(user.profileImageUrl, userId);
    }

    const updated = await getUserOrThrow(userId);
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
  // 실제 메일이 나가는 액션이라 남용 시 타인 메일함으로 인증 메일이 반복 발송될 수 있어
  // 1분 쿨다운 + 시간당 5회 상한을 둔다(재전송 UX 리뷰 반영).
  async requestEmailChange(userId: number, newEmail: string) {
    const user = await getUserOrThrow(userId);

    const now = new Date();
    if (
      user.emailChangeLastRequestedAt &&
      now.getTime() - user.emailChangeLastRequestedAt.getTime() < EMAIL_CHANGE_COOLDOWN_MS
    ) {
      throw new AppError('USER_EMAIL_CHANGE_RATE_LIMITED', '인증 메일은 1분에 한 번만 요청할 수 있습니다.');
    }
    const windowExpired =
      !user.emailChangeRequestWindowStart ||
      now.getTime() - user.emailChangeRequestWindowStart.getTime() >= EMAIL_CHANGE_WINDOW_MS;
    if (!windowExpired && user.emailChangeRequestCount >= EMAIL_CHANGE_MAX_PER_WINDOW) {
      throw new AppError(
        'USER_EMAIL_CHANGE_RATE_LIMITED',
        '이메일 변경 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.',
      );
    }

    const duplicated = await userRepository.existsByEmailOrPendingEmail(userId, newEmail);
    if (duplicated) {
      throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS);
    const rateLimit = {
      now,
      cooldownBoundary: new Date(now.getTime() - EMAIL_CHANGE_COOLDOWN_MS),
      windowExpired,
      currentWindowStart: user.emailChangeRequestWindowStart,
      windowBoundary: new Date(now.getTime() - EMAIL_CHANGE_WINDOW_MS),
      maxRequestsPerWindow: EMAIL_CHANGE_MAX_PER_WINDOW,
    };

    let result;
    try {
      result = await userRepository.setPendingEmailChange(userId, newEmail, tokenHash, expiresAt, rateLimit);
    } catch (err) {
      // 동시 요청이 중복 체크를 모두 통과한 뒤 pendingEmail의 DB unique 제약에서 충돌하는 경우.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('AUTH_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.');
      }
      logger.error(err);
      throw new AppError(
        'COMMON_INTERNAL_ERROR',
        '이메일 변경 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
    if (result.count === 0) {
      // 위 사전 검증과 실제 반영 사이에 동시 요청이 쿨다운/상한을 먼저 채운 경합 상황.
      throw new AppError('USER_EMAIL_CHANGE_RATE_LIMITED', '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
    }

    try {
      await sendEmailChangeVerification(newEmail, token);
    } catch {
      // 발송 실패 시 방금 건 pending 예약과 rate limit 반영분을 되돌린다 — 안 그러면 실제로 메일을
      // 못 받은 이메일이 TTL 동안 "사용 중"으로 남아 다른 유저의 동일 이메일 요청까지 막고,
      // 실패한 시도가 본인 쿨다운/상한까지 갉아먹게 된다.
      // 롤백 자체가 실패하더라도(예: DB 일시 장애) 원시 에러를 흘리지 않고 약속된 에러로 통일한다.
      try {
        await userRepository.clearPendingEmailChange(userId, newEmail, tokenHash, {
          lastRequestedAt: user.emailChangeLastRequestedAt,
          windowStart: user.emailChangeRequestWindowStart,
          count: user.emailChangeRequestCount,
        });
      } catch {
        // 롤백 실패는 아래에서 공통 에러로 던지므로 별도 처리 없이 무시한다.
      }
      throw new AppError('COMMON_INTERNAL_ERROR', '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
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
      logger.error(err);
      throw new AppError(
        'COMMON_INTERNAL_ERROR',
        '이메일 변경 확정에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
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
