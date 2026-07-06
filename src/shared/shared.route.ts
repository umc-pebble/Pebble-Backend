import { Router } from 'express';
import { shareCategory, removeMember, unshareCategory } from './shared.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SharedCategory
 *   description: 공유 카테고리 (P2 후속). SharedCategoryMember로 멤버/역할/상태 관리.
 */

/**
 * @swagger
 * /categories/{categoryId}/share:
 *   post:
 *     summary: 공유 카테고리 전환 (PLB-044)
 *     description: >
 *       기존 개인 카테고리를 공유 카테고리로 전환하고 팔로잉 관계인 친구를 초대합니다.
 *       요청자는 OWNER(status=ACCEPTED)로, 초대된 사용자는 MEMBER(status=PENDING)로
 *       SharedCategoryMember에 등록되며 카테고리의 isShared가 true로 바뀝니다.
 *       팔로잉 관계가 아닌 유저는 초대할 수 없습니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteUserIds]
 *             properties:
 *               inviteUserIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 초대할 사용자 id 목록 (팔로잉 관계만 가능, PENDING 상태로 등록)
 *                 example: [7, 8]
 *     responses:
 *       200:
 *         description: 전환·초대 완료
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SharedCategoryMember'
 *             example:
 *               code: 200
 *               message: 전환·초대 완료
 *               data: {}
 *       400:
 *         description: 팔로잉 관계가 아닌 유저 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 400
 *               message: 팔로잉 관계가 아닌 유저는 초대할 수 없습니다.
 *               data: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories/:categoryId/share', shareCategory);

/**
 * @swagger
 * /categories/{categoryId}/members/{userId}:
 *   patch:
 *     summary: 공유 멤버 관리 — 강퇴 (PLB-045)
 *     description: >
 *       오너가 특정 멤버를 강퇴합니다. 해당 SharedCategoryMember 레코드가 제거되지만,
 *       강퇴된 멤버가 만든 마일스톤/태스크는 유지됩니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *       - $ref: '#/components/parameters/MemberUserIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [KICK]
 *                 description: 수행할 멤버 관리 동작 (현재 KICK만 지원)
 *                 example: KICK
 *     responses:
 *       200:
 *         description: 강퇴 완료
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 200
 *               message: 강퇴 완료
 *               data: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 오너가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 403
 *               message: 공유 카테고리의 오너만 멤버를 강퇴할 수 있습니다.
 *               data: null
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/categories/:categoryId/members/:userId', removeMember);

/**
 * @swagger
 * /categories/{categoryId}/share:
 *   delete:
 *     summary: 공유 카테고리 삭제 (PLB-046)
 *     description: >
 *       오너가 공유 카테고리를 삭제합니다. 전체 멤버의 목록에서 즉시 제거되고
 *       하위 마일스톤/태스크도 전부 삭제(CASCADE)됩니다. 복구할 수 없습니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 200
 *               message: 삭제 완료
 *               data: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 오너가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 403
 *               message: 공유 카테고리의 오너만 삭제할 수 있습니다.
 *               data: null
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/categories/:categoryId/share', unshareCategory);

export default router;
