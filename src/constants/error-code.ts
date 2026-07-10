export const ERROR_CODE = {
  // 공통 — 모든 도메인에서 재사용
  COMMON_INVALID_INPUT: { code: 'COMMON_INVALID_INPUT', status: 400 },
  COMMON_UNAUTHORIZED: { code: 'COMMON_UNAUTHORIZED', status: 401 },
  COMMON_FORBIDDEN: { code: 'COMMON_FORBIDDEN', status: 403 },
  COMMON_NOT_FOUND: { code: 'COMMON_NOT_FOUND', status: 404 },
  COMMON_INTERNAL_ERROR: { code: 'COMMON_INTERNAL_ERROR', status: 500 },

  // Auth
  AUTH_EMAIL_DUPLICATED: { code: 'AUTH_EMAIL_DUPLICATED', status: 409 },
  AUTH_INVALID_CREDENTIAL: { code: 'AUTH_INVALID_CREDENTIAL', status: 401 },
  AUTH_TOKEN_EXPIRED: { code: 'AUTH_TOKEN_EXPIRED', status: 401 },

  // User
  USER_NICKNAME_COOLDOWN: { code: 'USER_NICKNAME_COOLDOWN', status: 400 },

  // Category
  CATEGORY_LIMIT_EXCEEDED: { code: 'CATEGORY_LIMIT_EXCEEDED', status: 403 },

  // Milestone
  MILESTONE_NO_PARENT: { code: 'MILESTONE_NO_PARENT', status: 400 },

  // Task
  TASK_NO_PARENT: { code: 'TASK_NO_PARENT', status: 400 },

  // File Upload
  FILE_SIZE_EXCEEDED: { code: 'FILE_SIZE_EXCEEDED', status: 400 },
  FILE_TYPE_NOT_ALLOWED: { code: 'FILE_TYPE_NOT_ALLOWED', status: 400 },

  // SharedCategory (PLB-044~048) — 팀장 승인 필요, PR에서 확인 요청
  CATEGORY_NOT_OWNER: { code: 'CATEGORY_NOT_OWNER', status: 403 }, // 오너 전용 작업(초대/강퇴/삭제)을 멤버가 시도
  CATEGORY_NOT_FRIEND: { code: 'CATEGORY_NOT_FRIEND', status: 400 }, // 팔로잉 관계가 아닌 유저를 초대 시도
  CATEGORY_MEMBER_DUPLICATED: { code: 'CATEGORY_MEMBER_DUPLICATED', status: 400 }, // 이미 멤버이거나 초대 대기 중인 유저 재초대

  // ─────────────────────────────────────────────
  // 제안 중 — 팀 승인 전까지 사용 보류
  // AUTH_SOCIAL_ONLY: { code: 'AUTH_SOCIAL_ONLY', status: 400 },       // 소셜 전용 계정의 비밀번호 변경/재설정 시도 (PLB-035/042)
  // FOLLOW_DUPLICATED: { code: 'FOLLOW_DUPLICATED', status: 409 },     // 중복 팔로우 요청
  // FOLLOW_SELF: { code: 'FOLLOW_SELF', status: 400 },                 // 자기 자신 팔로우 시도
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODE;
