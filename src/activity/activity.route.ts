import { Router } from 'express';
import { getMyGrass, getFriendGrass } from './activity.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: 징검다리(활동기록). 완료한 태스크 수 기반의 일별 통계 — 마일스톤·카테고리는 카운트하지 않음.
 */

/**
 * @swagger
 * /activity:
 *   get:
 *     summary: 내 징검다리 조회 (PLB-022~025)
 *     description: >
 *       완료 태스크 수 기반의 징검다리(활동기록)를 조회합니다.
 *       활동기록은 KST 0시~23:59 기준이며 완료한 태스크만 카운트합니다(마일스톤·카테고리 제외).
 *       과거 날짜의 태스크가 완료 취소/삭제되면 해당 날짜의 일별 통계만 실시간 재계산됩니다(전체 기간 재연산 없음).
 *       UI는 당일 포함 최근 7일을 보여주고, 당월 기준 1년까지 보관 후 삭제됩니다(PLB-025).
 *       completedTaskCount는 SINGLE/RANGE의 Task.completedAt과 REPEAT 회차의 TaskException.completedAt을 합산합니다.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: range
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           default: 1y
 *         description: 조회 기간 (기본 1y, 최대 1년)
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
 *                         grass:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/GrassDay'
 *             example:
 *               success: true
 *               message: 징검다리 조회 성공
 *               data:
 *                 grass:
 *                   - date: '2026-06-29'
 *                     completedTaskCount: 3
 *                     level: 2
 *                   - date: '2026-06-30'
 *                     completedTaskCount: 5
 *                     level: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/activity', getMyGrass);

/**
 * @swagger
 * /activity/{userId}:
 *   get:
 *     summary: 친구 징검다리 조회 (PLB-024)
 *     description: >
 *       팔로잉 관계인 친구의 징검다리를 조회합니다.
 *       팔로잉 관계가 아니거나 상대가 비공개인 경우 접근할 수 없습니다.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 친구의 사용자 id
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
 *                     data:
 *                       type: object
 *                       properties:
 *                         grass:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/GrassDay'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 조회 권한 없음 (팔로잉 관계 아님 또는 비공개)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
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
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 유저를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/activity/:userId', getFriendGrass);

export default router;
