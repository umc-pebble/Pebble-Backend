import { Router } from 'express';
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

const router = Router();

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
 *                     data: { $ref: '#/components/schemas/User' }
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
 *       닉네임 변경은 마지막 변경 후 15일(360시간) 쿨다운이 있으며, 쿨다운 중이면 400을 반환합니다.
 *       profileImageUrl에 null을 보내면 기본 이미지로 대체됩니다.
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
 *               nickname: { type: string, maxLength: 100, description: 변경 시 15일 쿨다운 적용, example: 큰바위 }
 *               bio: { type: string, nullable: true, example: 매일 한 걸음 }
 *               profileImageUrl: { type: string, nullable: true, description: null이면 기본 이미지, example: null }
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: 닉네임 변경 쿨다운(15일) 중이거나 입력값 오류
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 400, message: 닉네임은 15일마다 변경할 수 있습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me', updateMe);

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
 *             example: { code: 200, message: 회원탈퇴가 완료되었습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/users/me', deleteMe);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: 타인 프로필 조회
 *     description: 다른 회원의 공개 프로필을 조회합니다(팔로우 화면 등에서 사용).
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 조회 대상 사용자 id
 *         example: 7
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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
 *                         activityColor: { type: string, nullable: true, example: '#7ED321' }
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
 *       전달된 필드만 부분 수정됩니다. 징검다리 색상은 팔레트 내 값이어야 합니다.
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
 *               activityColor: { type: string, maxLength: 20, description: 팔레트 내 색상, example: '#4A90D9' }
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me/settings', updateSettings);

/**
 * @swagger
 * /users/me/password:
 *   patch:
 *     summary: 비밀번호 변경 (PLB-042)
 *     description: >
 *       현재 비밀번호 확인 후 새 비밀번호로 변경합니다. 소셜 전용 계정은 자체 비밀번호가 없어 변경할 수 없습니다.
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
 *         description: 변경 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 200, message: 비밀번호가 변경되었습니다., data: null }
 *       400:
 *         description: 현재 비밀번호 불일치, 형식 오류, 또는 소셜 전용 계정
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 400, message: 현재 비밀번호가 올바르지 않습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/users/me/password', changePassword);

/**
 * @swagger
 * /users/me/email/change-request:
 *   post:
 *     summary: 이메일 변경 인증 링크 발송 (PLB-042)
 *     description: 새 이메일로 인증 링크를 발송합니다. 인증 완료 전까지는 이메일이 변경되지 않습니다.
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
 *               newEmail: { type: string, format: email, example: new-pebble@umc.com }
 *     responses:
 *       200:
 *         description: 인증 링크 발송
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 200, message: 새 이메일로 인증 링크를 발송했습니다., data: null }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: 이미 사용 중인 이메일
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 409, message: 이미 사용 중인 이메일입니다., data: null }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/me/email/change-request', requestEmailChange);

/**
 * @swagger
 * /users/me/email/change-confirm:
 *   post:
 *     summary: 이메일 변경 확정 (PLB-042)
 *     description: 인증 링크의 token을 검증해 이메일 변경을 확정합니다. 토큰이 만료/위조되면 실패합니다.
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
 *               token: { type: string, description: 인증 메일 링크의 토큰, example: 'a1b2c3...' }
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: 토큰 만료/위조
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 400, message: 인증 링크가 만료되었습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/me/email/change-confirm', confirmEmailChange);

export default router;
