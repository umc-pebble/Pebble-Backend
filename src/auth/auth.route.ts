import { Router } from 'express';

import { validateBody } from '../middlewares/validate.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

import { signup, login, socialLogin, refresh, logout, issueTempPassword } from './auth.controller';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  tempPasswordSchema,
  socialLoginSchema,
} from './auth.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 인증 (자체 로그인 + 구글·네이버 소셜 병행). 대부분 공개 엔드포인트(토큰 불필요).
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: 회원가입 (PLB-001)
 *     description: >
 *       이메일·비밀번호로 회원가입합니다. 같은 이메일 중복 가입은 불가하며,
 *       가입 시 닉네임은 필수, 프로필 이미지·Bio는 선택입니다.
 *       닉네임은 중복 허용이나 닉네임#태그(uniqueTag) 조합은 유일하게 발급됩니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nickname]
 *             properties:
 *               email: { type: string, format: email, example: pebble@umc.com }
 *               password: { type: string, format: password, minLength: 8, example: 'pebble1234!' }
 *               nickname: { type: string, maxLength: 100, example: 조약돌 }
 *               profileImageUrl: { type: string, nullable: true, description: 업로드 후 받은 URL(선택), example: null }
 *               bio: { type: string, nullable: true, example: null }
 *     responses:
 *       201:
 *         description: 회원가입 성공 (가입 즉시 로그인 상태 — 토큰 발급)
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
 *                         user: { $ref: '#/components/schemas/User' }
 *                         accessToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.access...' }
 *                         refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.refresh...' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: 이미 가입된 이메일
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example: { success: false, message: 이미 가입된 이메일입니다., error: { code: "AUTH_EMAIL_DUPLICATED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/signup', validateBody(signupSchema), signup);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 자체 로그인 (PLB-002·047)
 *     description: >
 *       이메일·비밀번호로 로그인합니다. 이메일 또는 비밀번호가 틀리면
 *       어느 쪽이 틀렸는지 구분하지 않고 동일한 메시지를 반환합니다(PLB-047).
 *       성공 시 accessToken·refreshToken을 발급합니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: pebble@umc.com }
 *               password: { type: string, format: password, example: 'pebble1234!' }
 *     responses:
 *       200:
 *         description: >
 *           로그인 성공. 임시 비밀번호로 로그인한 경우 data.mustChangePassword: true가 포함되며
 *           프론트는 비밀번호 변경 화면으로 이동합니다(와프 U005).
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
 *                         user: { $ref: '#/components/schemas/User' }
 *                         accessToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.access...' }
 *                         refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.refresh...' }
 *                         mustChangePassword:
 *                           type: boolean
 *                           description: 임시 비밀번호 상태일 때만 true로 포함
 *                           example: false
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 이메일 또는 비밀번호 불일치 (통합 문구, PLB-047)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example: { success: false, message: 이메일 또는 비밀번호가 올바르지 않습니다., error: { code: "AUTH_INVALID_CREDENTIAL" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/login', validateBody(loginSchema), login);

/**
 * @swagger
 * /auth/social/{provider}:
 *   post:
 *     summary: 소셜 로그인 (PLB-002)
 *     description: >
 *       구글/네이버 OAuth 인가코드를 받아 로그인 또는 가입 처리합니다.
 *       인가코드 교환은 서버에서만 수행합니다(클라이언트 시크릿 보호).
 *       연동된 계정이 없으면 가입 처리 후 isNewUser: true를 반환하며,
 *       프론트는 이를 보고 프로필 설정 화면으로 유도합니다. 소셜 유저는 password가 NULL입니다.
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema: { type: string, enum: [google, naver] }
 *         description: 소셜 플랫폼
 *         example: google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, description: 프론트가 OAuth 콜백으로 받은 인가코드, example: '4/0AX4XfW...' }
 *               redirectUri: { type: string, description: 인가코드 발급에 사용한 redirect URI, example: 'https://pebble.app/oauth/callback' }
 *     responses:
 *       200:
 *         description: 로그인 성공 (기존 유저)
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
 *                         user: { $ref: '#/components/schemas/User' }
 *                         accessToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.access...' }
 *                         refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.refresh...' }
 *                         isNewUser: { type: boolean, description: 이번 요청으로 계정이 생성됐는지, example: false }
 *       201:
 *         description: 가입 + 로그인 성공 (신규 유저, isNewUser=true — 프로필 설정 화면 유도)
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
 *                         user: { $ref: '#/components/schemas/User' }
 *                         accessToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.access...' }
 *                         refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.refresh...' }
 *                         isNewUser: { type: boolean, example: true }
 *       400:
 *         description: 지원하지 않는 provider
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 지원하지 않는 소셜 플랫폼입니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         description: 인가코드 교환 실패
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 소셜 인증에 실패했습니다., error: { code: "AUTH_INVALID_CREDENTIAL" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/social/:provider', validateBody(socialLoginSchema), socialLogin);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: 토큰 재발급
 *     description: >
 *       refreshToken으로 새 accessToken을 재발급합니다. refreshToken도 함께 회전(재발급)되며,
 *       기존 refreshToken은 무효화되므로 새 것으로 교체 저장해야 합니다.
 *       저장된 refreshToken과 불일치하거나 만료된 경우 실패합니다(재로그인 유도).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1Ni.refresh...' }
 *     responses:
 *       200:
 *         description: 재발급 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthTokens' }
 *       401:
 *         description: 유효하지 않거나 만료된 refreshToken (재로그인 유도)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 리프레시 토큰이 만료되었거나 유효하지 않습니다., error: { code: "AUTH_TOKEN_EXPIRED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/refresh', validateBody(refreshSchema), refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: 로그아웃 (PLB-005)
 *     description: 서버에 저장된 refreshToken을 파기합니다. 클라이언트는 로컬 토큰을 삭제합니다.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 로그아웃 성공, data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/logout', authMiddleware, logout);

/**
 * @swagger
 * /auth/password/temp:
 *   post:
 *     summary: 임시 비밀번호 발급 (PLB-035)
 *     description: >
 *       가입 이메일로 임시 비밀번호를 발송합니다. 기존 비밀번호는 즉시 임시 비밀번호(해시)로
 *       교체되고 isTempPassword=TRUE가 됩니다. 임시 비밀번호는 만료 없이 새 비밀번호 설정 전까지
 *       유효하며, 새 비밀번호 설정은 임시 비밀번호로 로그인한 뒤 PATCH /users/me/password에서 처리합니다.
 *       계정 존재 여부 노출 방지를 위해 가입되지 않은 이메일에도 동일한 성공 응답을 반환합니다(실제 발송은 안 함).
 *       동일 이메일 재발급은 rate limit(5분 1회)을 적용합니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: pebble@umc.com }
 *     responses:
 *       200:
 *         description: 요청 접수 (가입 여부와 무관하게 동일 응답)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 입력하신 이메일로 임시 비밀번호를 발송했어요., data: null }
 *       400:
 *         description: 이메일 형식 오류(COMMON_INVALID_INPUT) 또는 소셜 전용 계정(AUTH_SOCIAL_ONLY)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 소셜 로그인 계정입니다. 해당 플랫폼에서 비밀번호를 변경해주세요., error: { code: "AUTH_SOCIAL_ONLY" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/password/temp', validateBody(tempPasswordSchema), issueTempPassword);

export default router;
