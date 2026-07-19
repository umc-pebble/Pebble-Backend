import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  shareCategorySchema,
  inviteMemberSchema,
  respondInviteSchema,
} from './shared.schema';
import {
  shareCategory,
  inviteMember,
  getMembers,
  respondInvite,
  leaveSharedCategory,
  removeMember,
  deleteSharedCategory,
} from './shared.controller';

const router = Router();

// SharedCategory API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
// 경로 한정 필수: category.route.ts와 동일한 이유로 '/categories'로 한정한다.
router.use('/categories', authMiddleware);

/**
 * @swagger
 * tags:
 *   name: SharedCategory
 *   description: 공유 카테고리 (P2 후속). SharedCategoryMember로 멤버/역할(OWNER·MEMBER)/상태(PENDING·ACCEPTED) 관리.
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
 *       description: >
 *         초대할 친구 목록. 카테고리 생성/편집 화면에서 닉네임 또는 이메일로 검색해 모은 목록을
 *         한 번에 전달한다 (항목당 nickname 또는 email 중 하나 지정).
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invites]
 *             properties:
 *               invites:
 *                 type: array
 *                 items:
 *                   type: object
 *                   description: nickname 또는 email 중 정확히 하나만 지정
 *                   oneOf:
 *                     - required: [nickname]
 *                       properties:
 *                         nickname: { type: string, description: 닉네임#태그 또는 닉네임, example: 큰바위 }
 *                     - required: [email]
 *                       properties:
 *                         email: { type: string, format: email, description: 이메일로 초대 시, example: friend@umc.com }
 *                 example:
 *                   - nickname: 큰바위
 *                   - email: friend@umc.com
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
 *               success: true
 *               message: 전환·초대 완료
 *               data:
 *                 - id: 5
 *                   categoryId: 1
 *                   userId: 42
 *                   role: OWNER
 *                   status: ACCEPTED
 *                 - id: 6
 *                   categoryId: 1
 *                   userId: 7
 *                   role: MEMBER
 *                   status: PENDING
 *       400:
 *         description: 대상 미지정(nickname·email 둘 다 없음), 또는 팔로잉 관계가 아닌 유저 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               noTarget:
 *                 summary: nickname/email 둘 다 없음
 *                 value: { success: false, message: 닉네임 또는 이메일을 입력해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *               notFriend:
 *                 summary: 팔로잉 관계가 아님
 *                 value: { success: false, message: 팔로잉 관계가 아닌 유저는 초대할 수 없습니다., error: { code: "CATEGORY_NOT_FRIEND" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 카테고리 또는 대상 유저를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 대상 유저를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       409:
 *         description: 이미 멤버이거나 초대 대기 중인 유저 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 이미 초대되었거나 멤버인 유저입니다.
 *               error:
 *                 code: CATEGORY_MEMBER_DUPLICATED
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories/:categoryId/share', validateBody(shareCategorySchema), shareCategory);

/**
 * @swagger
 * /categories/{categoryId}/members:
 *   post:
 *     summary: 공유 멤버 추가 초대 (PLB-048)
 *     description: >
 *       이미 공유 중인 카테고리에 친구를 추가로 초대합니다. 닉네임 또는 이메일로 한 명씩 초대하며,
 *       초대된 사용자는 MEMBER(status=PENDING)로 등록됩니다.
 *       초대는 오너만 가능하고, 대상은 오너와 팔로잉(친구) 관계여야 합니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *     requestBody:
 *       required: true
 *       description: nickname 또는 email 중 하나로 대상 지정 (한 명씩)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [nickname]
 *                 properties:
 *                   nickname: { type: string, description: 닉네임#태그 또는 닉네임, example: 큰바위 }
 *               - required: [email]
 *                 properties:
 *                   email: { type: string, format: email, description: 이메일로 초대 시, example: friend@umc.com }
 *     responses:
 *       201:
 *         description: 초대 성공 (PENDING 등록)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/SharedCategoryMember' }
 *             example:
 *               success: true
 *               message: 초대 성공
 *               data:
 *                 id: 6
 *                 categoryId: 1
 *                 userId: 9
 *                 role: MEMBER
 *                 status: PENDING
 *       400:
 *         description: 대상 미지정(nickname·email 둘 다 없음), 또는 팔로잉 관계 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             examples:
 *               noTarget:
 *                 summary: nickname/email 둘 다 없음
 *                 value: { success: false, message: 닉네임 또는 이메일을 입력해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *               notFriend:
 *                 summary: 팔로잉 관계가 아님
 *                 value: { success: false, message: 팔로잉 관계가 아닌 유저는 초대할 수 없습니다., error: { code: "CATEGORY_NOT_FRIEND" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 오너가 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 오너만 멤버를 초대할 수 있습니다., error: { code: "CATEGORY_NOT_OWNER" } }
 *       404:
 *         description: 공유 카테고리 또는 대상 유저 없음
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 대상 유저를 찾을 수 없습니다., error: { code: "COMMON_NOT_FOUND" } }
 *       409:
 *         description: 이미 멤버이거나 초대 대기 중
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 이미 초대되었거나 멤버인 유저입니다., error: { code: "CATEGORY_MEMBER_DUPLICATED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories/:categoryId/members', validateBody(inviteMemberSchema), inviteMember);

/**
 * @swagger
 * /categories/{categoryId}/members:
 *   get:
 *     summary: 공유 멤버 목록 조회
 *     description: >
 *       공유 카테고리의 멤버 목록을 조회합니다. 역할(OWNER/MEMBER)과 초대 상태(PENDING/ACCEPTED)를 포함합니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
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
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SharedCategoryMember'
 *             example:
 *               success: true
 *               message: 조회 성공
 *               data:
 *                 - id: 5
 *                   categoryId: 1
 *                   userId: 42
 *                   role: OWNER
 *                   status: ACCEPTED
 *                 - id: 6
 *                   categoryId: 1
 *                   userId: 9
 *                   role: MEMBER
 *                   status: PENDING
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 이 카테고리의 멤버가 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 이 카테고리의 멤버가 아닙니다., error: { code: "COMMON_FORBIDDEN" } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/categories/:categoryId/members', getMembers);

// NOTE: '/members/me'(본인 액션)는 '/members/:userId'(오너의 멤버 관리)보다 먼저 등록해야
// 'me'가 :userId로 매칭되는 충돌을 피할 수 있다.

/**
 * @swagger
 * /categories/{categoryId}/members/me:
 *   patch:
 *     summary: 공유 초대 수락/거절 (PLB-044)
 *     description: >
 *       나에게 온 공유 카테고리 초대(status=PENDING)를 수락(ACCEPT) 또는 거절(REJECT)합니다.
 *       수락 시 status=ACCEPTED가 되어 해당 카테고리가 내 카테고리 목록에 추가되고,
 *       거절 시 SharedCategoryMember 레코드가 삭제됩니다.
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
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [ACCEPT, REJECT], example: ACCEPT }
 *     responses:
 *       200:
 *         description: 처리 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 초대를 수락했습니다., data: null }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 나에게 온 대기 중(PENDING) 초대가 없음
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 대기 중인 초대를 찾을 수 없습니다., error: { code: "COMMON_NOT_FOUND" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  '/categories/:categoryId/members/me',
  validateBody(respondInviteSchema),
  respondInvite,
);

/**
 * @swagger
 * /categories/{categoryId}/members/me:
 *   delete:
 *     summary: 공유 카테고리 자진 탈퇴 (PLB-045)
 *     description: >
 *       멤버가 공유 카테고리에서 스스로 나갑니다. 내 목록에서 즉시 제거되며,
 *       내가 만든 마일스톤/태스크는 카테고리에 그대로 유지됩니다.
 *       오너는 탈퇴할 수 없고, 공유 삭제(DELETE /categories/{id}/share)를 사용해야 합니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *     responses:
 *       200:
 *         description: 탈퇴 완료
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 공유 카테고리에서 나갔습니다., data: null }
 *       400:
 *         description: 오너는 탈퇴 불가 (공유 삭제를 사용)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 오너는 탈퇴할 수 없습니다. 공유 삭제를 이용해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 내가 이 카테고리의 멤버가 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 멤버가 아닙니다., error: { code: "COMMON_NOT_FOUND" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/categories/:categoryId/members/me', leaveSharedCategory);

/**
 * @swagger
 * /categories/{categoryId}/members/{userId}:
 *   delete:
 *     summary: 공유 멤버 관리 — 강퇴 (PLB-045)
 *     description: >
 *       오너가 특정 멤버를 강퇴합니다. 해당 SharedCategoryMember 레코드가 제거되지만,
 *       강퇴된 멤버가 만든 마일스톤/태스크는 유지됩니다. 강퇴된 멤버에게는 별도 알림을 보내지 않습니다.
 *     tags: [SharedCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *       - $ref: '#/components/parameters/MemberUserIdPath'
 *     responses:
 *       200:
 *         description: 강퇴 완료
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: 강퇴 완료
 *               data: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 오너가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 공유 카테고리의 오너만 멤버를 강퇴할 수 있습니다.
 *               error:
 *                 code: CATEGORY_NOT_OWNER
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/categories/:categoryId/members/:userId', removeMember);

/**
 * @swagger
 * /categories/{categoryId}/share:
 *   delete:
 *     summary: 공유 카테고리 삭제 (PLB-046)
 *     description: >
 *       오너가 공유 카테고리를 삭제합니다. 전체 멤버의 목록에서 즉시 제거되고
 *       하위 마일스톤/태스크도 전부 삭제(CASCADE)됩니다. 복구할 수 없습니다.
 *       삭제 전 멤버 목록을 조회해 각 멤버에게 "{카테고리명} 카테고리가 삭제되었습니다." 알림(CATEGORY_DELETED)을 발송합니다.
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
 *               success: true
 *               message: 삭제 완료
 *               data: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 오너가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 공유 카테고리의 오너만 삭제할 수 있습니다.
 *               error:
 *                 code: CATEGORY_NOT_OWNER
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/categories/:categoryId/share', deleteSharedCategory);

export default router;