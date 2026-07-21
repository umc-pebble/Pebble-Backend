import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getNotifications,
  readNotification,
  deleteNotification,
  deleteAllNotifications,
} from './notification.controller';

const router = Router();

// Notification API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Notification
 *   description: 인앱 알림. 팔로우/일정/리포트/공유 카테고리 관련 알림. 최대 30일 보관(PLB-030·031·038).
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: 알림 목록 조회 (PLB-030)
 *     description: >
 *       내 알림 목록을 최신순으로 조회합니다. 읽음/안읽음은 isRead로 구분합니다.
 *       팔로우 요청(FOLLOW_REQUEST)처럼 수락/거절 선택이 필요한 알림도 함께 내려갑니다.
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *         description: 조회 시작 위치
 *         example: 0
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: 조회 개수 (최대 100)
 *         example: 20
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
 *                         notifications:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Notification' }
 *                         unreadCount:
 *                           type: integer
 *                           description: 안읽은 알림 수 (뱃지 표시용)
 *                           example: 3
 *                         page:
 *                           type: object
 *                           properties:
 *                             offset: { type: integer, example: 0 }
 *                             limit: { type: integer, example: 20 }
 *                             total: { type: integer, example: 42 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/notifications', getNotifications);

/**
 * @swagger
 * /notifications/{notificationId}/read:
 *   patch:
 *     summary: 알림 읽음 처리
 *     description: 특정 알림을 읽음(isRead=true) 상태로 변경합니다.
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 알림 id
 *         example: 88
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 알림을 읽음 처리했습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/notifications/:notificationId/read', readNotification);

/**
 * @swagger
 * /notifications/{notificationId}:
 *   delete:
 *     summary: 알림 개별 삭제 (PLB-031)
 *     description: 알림 목록에서 x 버튼으로 특정 알림을 삭제합니다. 복구 불가.
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 알림 id
 *         example: 88
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 알림을 삭제했습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/notifications/:notificationId', deleteNotification);

/**
 * @swagger
 * /notifications:
 *   delete:
 *     summary: 알림 전체 삭제 (PLB-030)
 *     description: >
 *       알림을 일괄 삭제합니다. 단, 수락/거절 선택이 필요한 알림(예: FOLLOW_REQUEST)이 있으면
 *       해당 알림만 남기고 나머지를 삭제합니다.
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 삭제 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 알림을 모두 삭제했습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/notifications', deleteAllNotifications);

export default router;
