import { Router } from 'express';

import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';

import {
  searchUsers,
  requestFollow,
  getFollows,
  acceptFollow,
  deleteFollow,
} from './follow.controller';
import {
  requestFollowSchema,
  searchUsersQuerySchema,
  followListQuerySchema,
} from './follow.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Follow
 *   description: >
 *     팔로우. 요청 → 수락 승인제이며, Follow row 하나로 양방향 관계를 표현합니다
 *     (수락 시 상호 열람 가능한 친구, PLB-033·034·041). 팔로잉 수는 어디에도 표기하지 않습니다(PLB-034).
 */

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: 유저 검색 (PLB-032)
 *     description: >
 *       닉네임 또는 이메일로 팔로우할 유저를 검색합니다. 닉네임은 부분 일치,
 *       이메일은 완전 일치만 지원합니다(가입자 이메일 열거 방지). 본인은 결과에서 제외되며,
 *       결과에는 프로필 이미지·닉네임·팔로우 버튼 상태(followStatus)가 포함됩니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: keyword
 *         in: query
 *         required: true
 *         schema: { type: string }
 *         description: 검색어 (닉네임 부분 일치 / 이메일 완전 일치)
 *         example: 조약돌
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 10 }
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId: { type: integer, example: 7 }
 *                           nickname: { type: string, example: 큰바위 }
 *                           uniqueTag: { type: string, example: '0417' }
 *                           profileImageUrl: { type: string, nullable: true, example: null }
 *                           followStatus:
 *                             type: string
 *                             enum: [NONE, PENDING, ACCEPTED]
 *                             description: 나와의 팔로우 관계 상태 (팔로우 버튼 분기용, PLB-033)
 *                             example: NONE
 *                     page:
 *                       type: object
 *                       properties:
 *                         offset: { type: integer, example: 0 }
 *                         limit: { type: integer, example: 10 }
 *                         total: { type: integer, example: 1 }
 *       400:
 *         description: keyword 누락
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 검색어를 입력해주세요., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users/search', authMiddleware, validateQuery(searchUsersQuerySchema), searchUsers);

/**
 * @swagger
 * /follows:
 *   post:
 *     summary: 팔로우 요청 (PLB-033·041)
 *     description: >
 *       대상 유저에게 팔로우를 요청합니다(status=PENDING row 생성).
 *       자기 자신은 요청할 수 없고, 이미 요청/친구 상태면 중복 생성되지 않습니다.
 *       대상에게 FOLLOW_REQUEST 알림이 발송됩니다(와프 A001).
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId: { type: integer, description: 팔로우할 대상 사용자 id, example: 7 }
 *     responses:
 *       201:
 *         description: 팔로우 요청 성공 — 버튼이 "요청 중" 상태로 변경 (PLB-033)
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
 *                         followId: { type: integer, example: 10 }
 *                         status: { type: string, enum: [PENDING], example: PENDING }
 *       400:
 *         description: 자기 자신 팔로우 시도
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 자기 자신은 팔로우할 수 없습니다., error: { code: "FOLLOW_SELF" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 이미 요청 중이거나 친구 상태
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 이미 팔로우 요청 중입니다., error: { code: "FOLLOW_DUPLICATED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/follows', authMiddleware, validateBody(requestFollowSchema), requestFollow);

/**
 * @swagger
 * /follows:
 *   get:
 *     summary: 팔로우 목록 조회 (PLB-034)
 *     description: >
 *       맞팔 친구 / 받은 요청 / 보낸 요청 목록을 조회합니다.
 *       금일 일정이 있는 유저는 hasTodaySchedule로 프로필 테두리를 활성화합니다(실시간 계산, DB 컬럼 아님).
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [friends, pending, sent], default: friends }
 *         description: friends=맞팔 친구(기본) / pending=받은 요청 / sent=보낸 요청
 *       - name: keyword
 *         in: query
 *         required: false
 *         schema: { type: string }
 *         description: 친구 목록 내 닉네임 검색 (와프 F002 친구 탭 검색창)
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: 조회 성공 (page.total은 페이징 내부용 — 팔로잉 수는 UI에 표기하지 않음, PLB-034)
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
 *                         type: object
 *                         properties:
 *                           followId: { type: integer, example: 10 }
 *                           userId: { type: integer, example: 2 }
 *                           nickname: { type: string, example: 페블친구 }
 *                           uniqueTag: { type: string, example: '1234' }
 *                           profileImageUrl: { type: string, nullable: true, example: 'https://...' }
 *                           hasTodaySchedule: { type: boolean, description: 프로필 테두리 활성화용, example: true }
 *                     page:
 *                       type: object
 *                       properties:
 *                         offset: { type: integer, example: 0 }
 *                         limit: { type: integer, example: 10 }
 *                         total: { type: integer, example: 1 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/follows', authMiddleware, validateQuery(followListQuerySchema), getFollows);

/**
 * @swagger
 * /follows/{followId}/accept:
 *   post:
 *     summary: 팔로우 수락 (PLB-041)
 *     description: >
 *       받은 요청을 수락합니다. 수신자만 가능합니다.
 *       수락 시 상태 변경(ACCEPTED) + 요청자에게 FOLLOW_ACCEPTED 알림 발송 등 부수효과가 있어
 *       액션 엔드포인트(POST)로 처리합니다(와프 A002). 수락하면 양방향 열람 가능한 친구가 됩니다.
 *       거절은 DELETE /follows/{followId}를 사용합니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: followId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 팔로우 요청 레코드 id
 *         example: 10
 *     responses:
 *       200:
 *         description: 수락 성공
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
 *                         followId: { type: integer, example: 10 }
 *                         status: { type: string, enum: [ACCEPTED], example: ACCEPTED }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 수신자가 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 수락 권한이 없습니다., error: { code: "COMMON_FORBIDDEN" } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/follows/:followId/accept', authMiddleware, acceptFollow);

/**
 * @swagger
 * /follows/{followId}:
 *   delete:
 *     summary: 팔로우 거절/취소/언팔 (PLB-034·041)
 *     description: >
 *       세 경우를 통합해 row를 삭제합니다 — ① 수신자의 거절(상대에게 알림 발송 안 함, PLB-041)
 *       ② 요청자의 취소 ③ 친구 상태에서 팔로잉 취소(PLB-034).
 *       요청자와 row 상태에 따라 서버가 분기하며, 당사자가 아니면 403입니다.
 *     tags: [Follow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: followId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: 팔로우 레코드 id
 *         example: 10
 *     responses:
 *       200:
 *         description: 처리 완료
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: true, message: 처리 완료, data: null }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 당사자가 아님
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 처리 권한이 없습니다., error: { code: "COMMON_FORBIDDEN" } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/follows/:followId', authMiddleware, deleteFollow);

export default router;
