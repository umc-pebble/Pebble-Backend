import { Router } from 'express';
import {
  searchUsers,
  requestFollow,
  getFollows,
  respondFollow,
  unfollow,
} from './follow.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Follow
 *   description: 팔로우. 요청 → 수락 수동 승인, 맞팔 개념 없는 단방향(PLB-041).
 */

/**
 * @swagger
 * /follows/search:
 *   get:
 *     summary: 유저 검색 (PLB-032)
 *     description: 닉네임 또는 이메일로 팔로우할 유저를 검색합니다. 결과에는 프로필 이미지·닉네임·팔로우 상태가 포함됩니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: keyword
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: 검색어 (닉네임 또는 이메일)
 *         example: 조약돌
 *     responses:
 *       200:
 *         description: 검색 성공
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
 *                         users:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: integer, example: 7 }
 *                               nickname: { type: string, example: 큰바위 }
 *                               uniqueTag: { type: string, example: '0417' }
 *                               profileImageUrl: { type: string, nullable: true, example: null }
 *                               followStatus:
 *                                 type: string
 *                                 enum: [NONE, PENDING, ACCEPTED]
 *                                 description: 나와의 팔로우 관계 상태
 *                                 example: NONE
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/follows/search', searchUsers);

/**
 * @swagger
 * /follows:
 *   post:
 *     summary: 팔로우 요청 (PLB-033)
 *     description: >
 *       대상 유저에게 팔로우를 요청합니다(status=PENDING 생성). 자기 자신은 요청할 수 없고,
 *       이미 요청/팔로우 중이면 중복 생성되지 않습니다. 대상에게 FOLLOW_REQUEST 알림이 발송됩니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [followingId]
 *             properties:
 *               followingId: { type: integer, description: 팔로우할 대상 사용자 id, example: 7 }
 *     responses:
 *       201:
 *         description: 팔로우 요청 성공 (PENDING)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Follow' }
 *       400:
 *         description: 자기 자신 팔로우 시도 또는 이미 요청/팔로우 중
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 400, message: 이미 팔로우 요청한 유저입니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/follows', requestFollow);

/**
 * @swagger
 * /follows:
 *   get:
 *     summary: 팔로잉/팔로워 목록 조회 (PLB-034)
 *     description: >
 *       type에 따라 내가 팔로잉하는 유저(following) 또는 나를 팔로우하는 유저(follower) 목록을 조회합니다.
 *       각 유저는 프로필 이미지·닉네임과 오늘 일정 유무(스토리 테두리 활성화용)를 포함할 수 있습니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [following, follower], default: following }
 *         description: 조회할 관계 방향 (기본 following)
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
 *                         follows:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Follow' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/follows', getFollows);

/**
 * @swagger
 * /follows/{followId}:
 *   patch:
 *     summary: 팔로우 요청 수락/거절 (PLB-041)
 *     description: >
 *       나에게 온 팔로우 요청을 수락(ACCEPT) 또는 거절(REJECT)합니다.
 *       수락 시 status=ACCEPTED가 되어 요청자가 나를 팔로잉하게 되고, 거절 시 요청 레코드가 삭제됩니다(거절 사실은 상대에게 알리지 않음).
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: followId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 팔로우 요청 레코드 id
 *         example: 15
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [ACCEPT, REJECT], example: ACCEPT }
 *     responses:
 *       200:
 *         description: 처리 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 200, message: 팔로우 요청을 수락했습니다., data: null }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 내게 온 요청이 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 403, message: 처리 권한이 없습니다., data: null }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/follows/:followId', respondFollow);

/**
 * @swagger
 * /follows/{followId}:
 *   delete:
 *     summary: 팔로잉 취소 (PLB-034)
 *     description: 내가 팔로잉 중인 관계를 취소(레코드 삭제)합니다. 목록에서 즉시 제거됩니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: followId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 팔로우 레코드 id
 *         example: 15
 *     responses:
 *       200:
 *         description: 취소 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { code: 200, message: 팔로잉을 취소했습니다., data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/follows/:followId', unfollow);

export default router;
