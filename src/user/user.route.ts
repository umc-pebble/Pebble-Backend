import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  getMe,
  updateMe,
  deleteMe,
  getUser,
  getSettings,
  updateSettings,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
} from './user.controller';
import {
  updateMeSchema,
  updateSettingsSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
} from './user.schema';

const router = Router();

// User API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: User
 *   description: 회원 프로필·설정. userId는 JWT에서 추출하며 본인 리소스는 /users/me 경로 사용.
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: 내 프로필 조회
 *     description: 로그인한 회원 본인의 프로필을 조회합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserProfile' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users/me', getMe);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: 프로필 편집 (PLB-043·003)
 *     description: >
 *       닉네임·Bio·프로필 이미지를 수정합니다. 전달된 필드만 부분 수정됩니다.
 *       닉네임은 중복 가능하며, 마지막 변경 후 15일(360시간) 쿨다운이 있어 이내 재변경 시 400을 반환합니다.
 *       profileImageUrl은 파일을 직접 보내는 것이 아니라, 먼저 POST /uploads/image로 업로드한 뒤 반환받은 URL을 전달합니다.
 *       null을 보내면 기본 이미지로 대체됩니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname: { type: string, maxLength: 100, description: 중복 가능, 변경 시 15일 쿨다운 적용, example: 큰바위 }
 *               bio: { type: string, nullable: true, example: 매일 한 걸음 }
 *               profileImageUrl: { type: string, nullable: true, description: POST /uploads/image로 먼저 업로드 후 받은 URL. null이면 기본 이미지, example: null }
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserProfileSummary' }
 *       400:
 *         description: 닉네임 변경 쿨다운(15일) 중이거나 입력값 오류
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             examples:
 *               cooldown:
 *                 summary: 닉네임 변경 쿨다운(15일) 중
 *                 value: { success: false, message: 닉네임은 15일마다 변경할 수 있습니다., error: { code: "USER_NICKNAME_COOLDOWN" } }
 *               invalidInput:
 *                 summary: 그 외 입력값 오류
 *                 value: { success: false, message: 요청 값이 올바르지 않습니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me', validateBody(updateMeSchema), updateMe);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: 회원탈퇴 (PLB-006)
 *     description: >
 *       회원 본인과 작성한 데이터(카테고리·마일스톤·태스크 등)를 모두 삭제하고,
 *       Supabase Storage의 프로필 이미지도 함께 삭제합니다. 소셜 로그인 유저는 플랫폼 연동도 해제합니다.
 *       복구할 수 없습니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 탈퇴 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 회원탈퇴가 완료되었습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/users/me', deleteMe);

// 타인 프로필 조회: 불필요한 것으로 판명되어 Swagger 문서에서 제외했다. 라우트 자체는
// 하위 호환을 위해 스텁으로 남겨둔다("미구현" 응답).
router.get('/users/:userId', getUser);

/**
 * @swagger
 * /users/me/settings:
 *   get:
 *     summary: 설정 조회 (PLB-042)
 *     description: 앱 테마·알림·징검다리 색상 등 설정 값을 조회합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         theme: { type: string, enum: [LIGHT, DARK], example: LIGHT }
 *                         notifyTaskDue: { type: boolean, example: true }
 *                         activityColor: { type: string, enum: ['#A3A3A3', '#82A0FF', '#ABE692', '#FFE48B', '#FFB67A', '#FFB4B4'], example: '#82A0FF' }
 *                         isSocialOnly: { type: boolean, description: true이면 FE에서 비밀번호 변경 항목을 비활성화, example: false }
 *                         isTempPassword: { type: boolean, description: true이면 FE에서 비밀번호 변경 권장 UI를 노출, example: false }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users/me/settings', getSettings);

/**
 * @swagger
 * /users/me/settings:
 *   patch:
 *     summary: 설정 수정 (PLB-042·026)
 *     description: >
 *       앱 테마(LIGHT/DARK), 당일·마감 알림 on/off, 징검다리 색상(activityColor)을 수정합니다.
 *       전달된 필드만 부분 수정됩니다. 징검다리 색상은 PEBBLE 팔레트 6종(조약돌·시냇물·새싹·햇살·노을·꽃) 중 하나여야 합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme: { type: string, enum: [LIGHT, DARK], example: DARK }
 *               notifyTaskDue: { type: boolean, example: false }
 *               activityColor: { type: string, enum: ['#A3A3A3', '#82A0FF', '#ABE692', '#FFE48B', '#FFB67A', '#FFB4B4'], description: 팔레트 내 색상, example: '#82A0FF' }
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         theme: { type: string, enum: [LIGHT, DARK], example: DARK }
 *                         notifyTaskDue: { type: boolean, example: false }
 *                         activityColor: { type: string, enum: ['#A3A3A3', '#82A0FF', '#ABE692', '#FFE48B', '#FFB67A', '#FFB4B4'], example: '#FFB67A' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me/settings', validateBody(updateSettingsSchema), updateSettings);

/**
 * @swagger
 * /users/me/password:
 *   patch:
 *     summary: 비밀번호 변경 (PLB-042)
 *     description: >
 *       현재 비밀번호 확인 후 새 비밀번호로 변경합니다. 소셜 전용 계정은 자체 비밀번호가 없어 변경할 수 없습니다.
 *       성공 시 기존 세션은 전부 로그아웃 처리되며, 신규 accessToken/refreshToken을 재발급합니다.
 *       임시 비밀번호 상태였다면 isTempPassword가 false로 복귀합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password, example: 'pebble1234!' }
 *               newPassword: { type: string, format: password, minLength: 8, example: 'newPebble1234!' }
 *     responses:
 *       200:
 *         description: 변경 성공. 기존 세션은 모두 무효화되고 신규 토큰이 발급됩니다.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthTokens' }
 *             example:
 *               success: true
 *               message: 비밀번호가 변경되었습니다.
 *               data:
 *                 accessToken: 'eyJhbGciOiJIUzI1Ni.access...'
 *                 refreshToken: 'eyJhbGciOiJIUzI1Ni.refresh...'
 *       400:
 *         description: 현재 비밀번호 불일치, 형식 오류, 또는 소셜 전용 계정
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             examples:
 *               socialOnly:
 *                 summary: 소셜 전용 계정
 *                 value: { success: false, message: 소셜 로그인 계정은 비밀번호를 변경할 수 없습니다., error: { code: "AUTH_SOCIAL_ONLY" } }
 *               invalidInput:
 *                 summary: 현재 비밀번호 불일치 또는 형식 오류
 *                 value: { success: false, message: 현재 비밀번호가 올바르지 않습니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me/password', validateBody(changePasswordSchema), changePassword);

/**
 * @swagger
 * /users/me/email/request:
 *   post:
 *     summary: 이메일 변경 요청 (PLB-042)
 *     description: >
 *       새 이메일로 인증 링크를 발송합니다. 이 요청 자체는 이메일을 바꾸지 않으며,
 *       리소스를 직접 수정하는 게 아니라 변경 프로세스를 시작시키는 액션이라 POST를 사용합니다.
 *       아래 POST /users/me/email/confirm으로 토큰을 검증해야 실제 이메일이 변경됩니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail]
 *             properties:
 *               newEmail: { type: string, format: email, example: new@example.com }
 *     responses:
 *       200:
 *         description: 인증 링크 발송
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 인증 링크를 발송했습니다. 이메일을 확인해주세요., data: null }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: 이미 사용 중인 이메일
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 이미 사용 중인 이메일입니다., error: { code: "AUTH_EMAIL_DUPLICATED" } }
 *       429:
 *         description: 요청 빈도 초과 (1분 쿨다운 또는 시간당 5회 상한)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             examples:
 *               cooldown:
 *                 summary: 쿨다운 미경과
 *                 value: { success: false, message: 인증 메일은 1분에 한 번만 요청할 수 있습니다., error: { code: "USER_EMAIL_CHANGE_RATE_LIMITED" } }
 *               hourlyLimit:
 *                 summary: 시간당 상한 초과
 *                 value: { success: false, message: 이메일 변경 요청이 너무 많습니다. 1시간 후 다시 시도해주세요., error: { code: "USER_EMAIL_CHANGE_RATE_LIMITED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/me/email/request', validateBody(requestEmailChangeSchema), requestEmailChange);

/**
 * @swagger
 * /users/me/email/confirm:
 *   post:
 *     summary: 이메일 변경 확정 (PLB-042)
 *     description: >
 *       POST /users/me/email/request로 발송된 인증 링크의 token을 검증해 이메일 변경을 확정합니다.
 *       토큰이 만료되었거나 위조된 경우 400을 반환합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: 인증 메일 링크에 담긴 토큰, example: 'a1b2c3...' }
 *     responses:
 *       200:
 *         description: 이메일 변경 완료
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserProfile' }
 *             example:
 *               success: true
 *               message: 이메일이 변경되었습니다.
 *               data:
 *                 id: 1
 *                 email: new@example.com
 *                 nickname: pebble
 *                 uniqueTag: '1234'
 *       400:
 *         description: 인증 링크가 만료되었거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 인증 링크가 만료되었거나 유효하지 않습니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/me/email/confirm', validateBody(confirmEmailChangeSchema), confirmEmailChange);

export default router;
