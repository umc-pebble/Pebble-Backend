import { Router } from 'express';
import { getActivityByUserId } from './activity.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Activity-logs
 *   description: 징검다리(활동기록). 완료한 태스크 수 기반의 일별 통계 — 마일스톤·카테고리는 카운트하지 않음.
 */

/**
 * @swagger
 * /activity-logs/users/{userId}:
 *   get:
 *     summary: 징검다리 조회
 *     description: >
 *       본인 또는 친구/팔로우 관계인 사용자의 활동기록을 조회합니다.
 *       기준 날짜를 포함하여 최근 7일의 완료 태스크 수와 진하기 단계를 반환합니다.
 *     tags: [Activity-logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 활동기록을 조회할 사용자 ID
 *         example: 1
 *       - name: baseDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 기준 날짜(미입력 시 당일 기준) - 기준 날짜를 포함하여 최근 7일 조회
 *         example: 2026-06-11
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
 *                         userId:
 *                           type: integer
 *                           example: 1
 *                         nickname:
 *                           type: string
 *                           example: 페블이
 *                         activityColor:
 *                           type: string
 *                           description: 활동기록 색상 HEX 문자열
 *                           pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$'
 *                           example: '#22C55E'
 *                         baseDate:
 *                           type: string
 *                           format: date
 *                           example: 2026-06-11
 *                         logs:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/GrassDay'
 *
 *       400:
 *         description: 잘못된 요청 값
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidUserId:
 *                 summary: 잘못된 사용자 ID
 *                 value:
 *                   success: false
 *                   message: 유효하지 않은 사용자 ID입니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidBaseDate:
 *                 summary: 잘못된 기준 날짜
 *                 value:
 *                   success: false
 *                   message: baseDate는 YYYY-MM-DD 형식이어야 합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 조회 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 징검다리를 조회할 권한이 없습니다.
 *               error:
 *                 code: COMMON_FORBIDDEN
 *       404:
 *         description: 유저를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 유저를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/activity-logs/users/:userId', authMiddleware, getActivityByUserId);

export default router;