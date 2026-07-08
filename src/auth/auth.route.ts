import { Router } from 'express';
import {
  signup,
  login,
  googleLogin,
  naverLogin,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
} from './auth.controller';

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
 *       가입 완료 시 예시 카테고리·마일스톤·태스크가 자동 생성(온보딩)됩니다.
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
 *         description: 회원가입 성공
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
 *                         tokens: { $ref: '#/components/schemas/AuthTokens' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: 이미 가입된 이메일
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example: { success: false, message: 이미 사용 중인 이메일입니다., error: { code: "AUTH_EMAIL_DUPLICATED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/signup', signup);

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
 *         description: 로그인 성공
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
 *                         tokens: { $ref: '#/components/schemas/AuthTokens' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example: { success: false, message: 이메일 또는 비밀번호가 올바르지 않습니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/login', login);

/**
 * @swagger
 * /auth/social/google:
 *   post:
 *     summary: 구글 소셜 로그인 (PLB-002)
 *     description: >
 *       클라이언트가 구글에서 받은 idToken(또는 authCode)을 전달하면 서버가 검증하고,
 *       연동된 SocialAccount가 없으면 최초 로그인으로 계정을 생성(온보딩 포함)한 뒤 토큰을 발급합니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: 구글 OAuth idToken, example: 'ya29.a0Af...' }
 *     responses:
 *       200:
 *         description: 로그인 성공 (신규/기존 공통)
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
 *                         tokens: { $ref: '#/components/schemas/AuthTokens' }
 *                         isNewUser: { type: boolean, description: 이번 요청으로 계정이 생성됐는지, example: false }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 구글 토큰 검증 실패
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 소셜 인증에 실패했습니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/social/google', googleLogin);

/**
 * @swagger
 * /auth/social/naver:
 *   post:
 *     summary: 네이버 소셜 로그인 (PLB-002)
 *     description: 네이버 accessToken을 전달받아 검증 후 로그인/최초가입 처리합니다. 흐름은 구글과 동일합니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken: { type: string, description: 네이버 OAuth accessToken, example: 'AAAAO...' }
 *     responses:
 *       200:
 *         description: 로그인 성공 (신규/기존 공통)
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
 *                         tokens: { $ref: '#/components/schemas/AuthTokens' }
 *                         isNewUser: { type: boolean, example: true }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 네이버 토큰 검증 실패
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 소셜 인증에 실패했습니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/social/naver', naverLogin);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: 액세스 토큰 재발급
 *     description: >
 *       refreshToken으로 새 accessToken(및 refreshToken)을 재발급합니다.
 *       저장된 refreshToken과 불일치하거나 만료된 경우 실패합니다.
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
 *         description: 유효하지 않거나 만료된 refreshToken
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 유효하지 않은 토큰입니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/refresh', refresh);

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
router.post('/auth/logout', logout);

/**
 * @swagger
 * /auth/password/reset-request:
 *   post:
 *     summary: 비밀번호 재설정 링크 발송 (PLB-035)
 *     description: >
 *       가입된 이메일로 재설정 링크를 발송합니다(링크 30분 유효).
 *       소셜 전용 계정이면 자체 비밀번호가 없어 재설정할 수 없습니다.
 *       보안상, 가입되지 않은 이메일이어도 동일한 성공 메시지를 반환하고 실제 발송은 하지 않습니다(계정 존재 노출 방지).
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
 *             example: { success: true, message: 입력하신 이메일로 재설정 링크를 발송했습니다., data: null }
 *       400:
 *         description: 소셜 전용 계정이라 자체 비밀번호 재설정 불가
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 소셜 로그인 계정입니다. 해당 플랫폼에서 관리해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/password/reset-request', requestPasswordReset);

/**
 * @swagger
 * /auth/password/reset:
 *   post:
 *     summary: 비밀번호 재설정 확정 (PLB-035)
 *     description: >
 *       메일 링크의 token과 새 비밀번호로 재설정을 확정합니다.
 *       토큰이 만료/사용됨/위조된 경우 실패하며, 성공 시 기존 세션(refreshToken)은 모두 파기됩니다.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string, description: 메일 링크의 재설정 토큰, example: '3f9a1c...' }
 *               newPassword: { type: string, format: password, minLength: 8, example: 'newPebble1234!' }
 *     responses:
 *       200:
 *         description: 재설정 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 비밀번호가 변경되었습니다. 다시 로그인해주세요., data: null }
 *       400:
 *         description: 토큰 만료/사용됨/위조 또는 비밀번호 형식 오류
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 링크가 만료되었습니다. 다시 요청해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth/password/reset', resetPassword);

export default router;
