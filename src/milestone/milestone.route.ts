import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  reorderMilestonesSchema,
} from './milestone.schema';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
} from './milestone.controller';

const router = Router();

// 마일스톤 API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
// 경로 한정 필수: 공유 마운트(/api/v1) 구조에서 경로 없는 use()는 타 도메인까지 막는다.
router.use(['/categories', '/milestones'], authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Milestone
 *   description: 마일스톤 (카테고리 하위 계층, userId 없이 카테고리로 소유 판정)
 */

/**
 * @swagger
 * /categories/{categoryId}/milestones:
 *   get:
 *     summary: 마일스톤 목록 조회 (PLB-015·016)
 *     description: >
 *       카테고리에 속한 마일스톤을 D-Day 가까운 순(오름차순)으로 조회합니다.
 *       ※ MULTIPLE(다중)는 준비 중 — 현재 저장되는 마일스톤은 SINGLE/RANGE뿐입니다.
 *       (구현 예정: MULTIPLE는 날짜별 회차 row로 저장되어 그대로 조회되며, 같은 seriesId를 공유)
 *       상위 카테고리가 숨김 처리된 경우 마일스톤·태스크도 캘린더에서 함께 숨겨지며,
 *       마일스톤 개별 숨김은 불가능합니다.
 *     tags: [Milestone]
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
 *                       type: object
 *                       properties:
 *                         milestones:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Milestone'
 *             example:
 *               success: true
 *               message: 마일스톤 조회 성공
 *               data:
 *                 milestones:
 *                   - id: 8
 *                     seriesId: null
 *                     name: 공모전 마감
 *                     dateType: SINGLE
 *                     startDate: '2026-07-10'
 *                     endDate: null
 *                     isCompleted: false
 *                   - id: 9
 *                     seriesId: null
 *                     name: 개발 기간
 *                     dateType: RANGE
 *                     startDate: '2026-07-14'
 *                     endDate: '2026-07-30'
 *                     isCompleted: false
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/categories/:categoryId/milestones', getMilestones);

/**
 * @swagger
 * /categories/{categoryId}/milestones:
 *   post:
 *     summary: 마일스톤 생성 (PLB-012)
 *     description: >
 *       카테고리 하위에 마일스톤을 생성합니다. 날짜는 단일(SINGLE)/기간(RANGE)으로 지정합니다.
 *       이름 중복이 허용되며, 같은 카테고리 안에서 기간이 중복될 수 있습니다.
 *       마일스톤은 카테고리와 같은 계열 색상으로 표기되고(색상 필드 없음), 생성 시 기본 상태는 "미완료"입니다.
 *       ※ MULTIPLE(다중)는 준비 중 — 현재 dateType=MULTIPLE 지정 시 400을 반환합니다.
 *       (구현 예정: dates 배열의 날짜마다 회차 row를 일괄 생성하고 같은 seriesId 부여, 요일 반복 개념 없음)
 *     tags: [Milestone]
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
 *             required: [name, dateType, startDate]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 중복 허용
 *                 example: 개발 기간
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE]
 *                 description: '현재 SINGLE/RANGE만 지원. MULTIPLE는 준비 중(지정 시 400)'
 *                 example: RANGE
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: 필수 (YYYY-MM-DD)
 *                 example: '2026-07-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: RANGE일 때만 사용 (YYYY-MM-DD). SINGLE/MULTIPLE에서는 null
 *                 example: '2026-07-20'
 *               dates:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: string
 *                   format: date
 *                 description: '준비 중 — MULTIPLE 전용 필드(현재 MULTIPLE 자체가 400). (구현 예정: 캘린더에서 선택한 날짜 배열, 날짜마다 회차 row 생성)'
 *                 example: null
 *     responses:
 *       201:
 *         description: 마일스톤 생성 성공. 생성된 마일스톤을 배열로 반환합니다(SINGLE/RANGE는 1건 — MULTIPLE 구현 시 회차 전체가 담기는 형태 유지를 위해 배열).
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
 *                         milestones:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Milestone'
 *             example:
 *               success: true
 *               message: 마일스톤 생성 성공
 *               data:
 *                 milestones:
 *                   - id: 101
 *                     seriesId: null
 *                     name: 개발 기간
 *                     dateType: RANGE
 *                     startDate: '2026-07-13'
 *                     endDate: '2026-07-30'
 *                     isCompleted: false
 *       400:
 *         description: 입력값 오류 (dateType과 날짜 필드 조합 불일치, MULTIPLE인데 dates 누락·빈 배열 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 요청 값이 올바르지 않습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories/:categoryId/milestones', validateBody(createMilestoneSchema), createMilestone);

/**
 * @swagger
 * /categories/{categoryId}/milestones/order:
 *   patch:
 *     summary: 마일스톤 순서 변경 (PLB-016)
 *     description: >
 *       같은 카테고리 내에서 마일스톤 순서를 변경합니다. 카테고리 간 이동은 불가합니다.
 *       기본 정렬은 D-Day 가까운 순(오름차순)이며, 드래그 앤 드롭 결과를 orderedIds로 전달합니다.
 *     tags: [Milestone]
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
 *             required: [orderedIds]
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 화면 순서대로 나열한 milestoneId 배열
 *                 example: [8, 5, 11]
 *     responses:
 *       200:
 *         description: 순서 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: 순서 변경 성공
 *               data: {}
 *       400:
 *         description: 다른 카테고리의 마일스톤 ID 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 다른 카테고리의 마일스톤이 포함되어 있습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/categories/:categoryId/milestones/order', validateBody(reorderMilestonesSchema), reorderMilestones);

/**
 * @swagger
 * /milestones/{milestoneId}:
 *   patch:
 *     summary: 마일스톤 수정 (PLB-012·013)
 *     description: >
 *       마일스톤 이름·날짜·완료 여부를 수정합니다. 전달된 필드만 부분 수정됩니다.
 *       ※ MULTIPLE·editScope는 준비 중 — 현재 editScope 지정 시 400을 반환합니다. 아래는 구현 예정 동작:
 *       다중(MULTIPLE) 마일스톤은 회차마다 실제 row로 존재하며, 이름·완료 등을 수정할 때 editScope로
 *       "이 항목만 수정 / 전체 수정"을 반드시 지정합니다(기본값 없음, 둘 중 택1).
 *       editScope=THIS_ONLY → URL로 지정한 회차 row 1건만 UPDATE,
 *       editScope=ALL → 같은 seriesId 중 "오늘 이후 + 미완료" 회차만 일괄 UPDATE
 *       (완료된 과거 회차는 보존, PLB-013).
 *       단, 날짜(startDate)만 변경하는 경우에는 범위 선택 모달이 뜨지 않으며 항상 해당 회차 1건만
 *       이동합니다(editScope 불필요, PLB-013). 즉 editScope는 이름·완료 등 날짜 외 필드를 바꿀 때만 필요합니다.
 *       SINGLE/RANGE 마일스톤에는 editScope를 지정할 수 없습니다.
 *     tags: [Milestone]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/MilestoneIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 변경할 이름 (중복 허용)
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE, MULTIPLE]
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 날짜 변경. MULTIPLE 회차 row에서는 해당 회차의 날짜. 날짜만 변경 시 editScope 없이 이 회차 1건만 이동 (PLB-013)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 날짜 변경 (RANGE일 때)
 *               isCompleted:
 *                 type: boolean
 *                 description: 완료/미완료 토글 (회차 row별 독립 기록)
 *               editScope:
 *                 type: string
 *                 enum: [THIS_ONLY, ALL]
 *                 description: '준비 중 — MULTIPLE 전용(현재 지정 시 400). (구현 예정: 날짜 외 필드 수정 시 필수 택1. THIS_ONLY=이 회차 1건 / ALL=같은 seriesId의 오늘 이후 미완료 회차 일괄)'
 *           examples:
 *             completeToggle:
 *               summary: 완료 처리 (SINGLE/RANGE — scope 없이)
 *               value:
 *                 isCompleted: true
 *             thisOnly:
 *               summary: (준비 중 — 현재 400) 다중 중 이 회차만 이름 수정
 *               value:
 *                 editScope: THIS_ONLY
 *                 name: 긴급 회의
 *             editAll:
 *               summary: (준비 중 — 현재 400) 전체 수정 (오늘 이후 미완료 회차 일괄)
 *               value:
 *                 editScope: ALL
 *                 name: 주간 회의
 *     responses:
 *       200:
 *         description: 수정 성공. editScope=ALL이어도 URL로 지정한 회차 기준으로 응답 (나머지 회차에 동일 반영)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Milestone'
 *       400:
 *         description: MULTIPLE인데 editScope 누락, SINGLE/RANGE에 editScope 지정, 또는 dateType과 날짜 필드 조합 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 다중 마일스톤이 아니면 editScope를 지정할 수 없습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/milestones/:milestoneId', validateBody(updateMilestoneSchema), updateMilestone);

/**
 * @swagger
 * /milestones/{milestoneId}:
 *   delete:
 *     summary: 마일스톤 삭제 (PLB-014)
 *     description: >
 *       마일스톤을 삭제합니다. 하위 태스크가 함께 삭제(CASCADE)되며 복구할 수 없습니다.
 *       ※ MULTIPLE·deleteScope는 준비 중 — 현재 deleteScope 지정 시 400을 반환합니다. 아래는 구현 예정 동작:
 *       다중(MULTIPLE) 마일스톤은 deleteScope로 "이 항목만 삭제 / 전체 삭제"를 반드시 지정합니다(기본값 없음, 둘 중 택1).
 *       deleteScope=THIS_ONLY → URL로 지정한 회차 row 1건만 삭제,
 *       deleteScope=ALL → 같은 seriesId 중 "오늘 이후 + 미완료" 회차만 일괄 삭제
 *       (완료된 과거 회차는 보존, PLB-014).
 *       SINGLE/RANGE 마일스톤에는 deleteScope를 지정할 수 없습니다.
 *       확인 모달(네/아니오)은 프론트엔드에서 처리합니다.
 *     tags: [Milestone]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/MilestoneIdPath'
 *       - name: deleteScope
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [THIS_ONLY, ALL]
 *         description: '준비 중 — MULTIPLE 전용(현재 지정 시 400). (구현 예정: MULTIPLE 삭제 시 필수 택1. THIS_ONLY=이 회차 1건 / ALL=같은 seriesId의 오늘 이후 미완료 회차 일괄)'
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: 마일스톤 삭제 성공
 *               data: {}
 *       400:
 *         description: MULTIPLE인데 deleteScope 누락, 또는 SINGLE/RANGE에 deleteScope 지정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 다중 마일스톤이 아니면 deleteScope를 지정할 수 없습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/milestones/:milestoneId', deleteMilestone);

export default router;
