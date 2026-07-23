import { Router } from 'express';
import { getMySubscription, verifySubscription } from './subscription.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: 구독(애플 IAP). 프리미엄 여부 판정(카테고리 무제한 등)에 사용. 결제 이력 보존.
 */

/**
 * @swagger
 * /subscriptions/me:
 *   get:
 *     summary: 내 구독 상태 조회
 *     description: >
 *       현재 로그인한 회원의 구독 상태를 조회합니다. status=ACTIVE이면 프리미엄 기능(카테고리 무제한 등)이 활성입니다.
 *       구독 이력이 없으면 data는 null입니다.
 *     tags: [Subscription]
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
 *                       nullable: true
 *                       allOf:
 *                         - $ref: '#/components/schemas/Subscription'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/subscriptions/me', getMySubscription);

/**
 * @swagger
 * /subscriptions/verify:
 *   post:
 *     summary: 애플 IAP 영수증 검증·구독 등록
 *     description: >
 *       클라이언트가 애플에서 받은 영수증(트랜잭션)을 서버가 애플 서버에 검증한 뒤
 *       구독을 생성/갱신합니다(originalTransactionId 기준으로 상태·기간 반영).
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transactionId]
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: 애플 IAP 트랜잭션 id (또는 영수증 데이터)
 *                 example: '2000000123456789'
 *     responses:
 *       200:
 *         description: 검증·반영 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Subscription' }
 *       400:
 *         description: 영수증 검증 실패(위조/만료 등)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 영수증 검증에 실패했습니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/subscriptions/verify', verifySubscription);

export default router;
