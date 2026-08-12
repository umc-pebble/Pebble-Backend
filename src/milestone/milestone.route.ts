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
  getMonthlyMilestones,
  getFriendMilestones,
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
 *   description: 마일스톤 (카테고리 하위 계층, userId 없이 상위 카테고리로 권한 판정 — 공유 카테고리에서는 오너와 초대를 수락한 멤버가 동등)
 */

/**
 * @swagger
 * /categories/{categoryId}/milestones:
 *   get:
 *     summary: 마일스톤 목록 조회 (PLB-015·016)
 *     description: >
 *       카테고리에 속한 마일스톤을 D-Day 가까운 순(오름차순)으로 조회합니다.
 *       (생성 시 날짜 기준 위치로 순번이 부여되고, 드래그 앤 드롭으로 바꾼 순서는 그대로 유지됩니다)
 *       MULTIPLE(다중)는 날짜별 회차 row로 저장되어 그대로 조회되며, 같은 seriesId를 공유합니다.
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
 * /milestones:
 *   get:
 *     summary: 월별 마일스톤 조회
 *     description: >
 *       조회 월에 걸치는 마일스톤을 카테고리 구분 없이 한 번에 조회합니다.
 *       월별 화면을 조립할 때 `GET /tasks`와 짝으로 사용하며, baseDate 형식·기본값은 동일합니다.
 *       응답은 평탄한 배열이고, 각 항목의 categoryId로 카테고리별 그룹핑을 하면 됩니다.
 *
 *       포함 범위는 `GET /categories`와 같습니다 — 본인 소유 카테고리와 초대를 수락(ACCEPTED)한
 *       공유 카테고리의 마일스톤이 모두 포함됩니다. 마일스톤은 userId가 없어 카테고리 접근 권한이
 *       곧 마일스톤 접근 권한이므로, 이 결과가 그대로 "현재 로그인 사용자가 접근 가능한 마일스톤"입니다.
 *       숨김(isHidden) 카테고리의 마일스톤은 제외됩니다(태스크 월별 조회와 동일).
 *
 *       월 판정 기준은 날짜 유형별로 다릅니다.
 *       SINGLE·MULTIPLE은 해당 날짜가 조회 월에 속하면 포함되고(MULTIPLE은 회차 row마다 개별 판정),
 *       RANGE는 기간이 조회 월과 하루라도 겹치면 포함됩니다.
 *     tags: [Milestone]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: baseDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-08-01'
 *         description: >
 *           조회할 월에 속하는 임의의 날짜(YYYY-MM-DD). 일(day)은 무시하고 해당 월 전체를 조회합니다.
 *           생략하면 KST 기준 오늘이 속한 달을 조회합니다.
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
 *               message: 월별 마일스톤 조회 성공
 *               data:
 *                 milestones:
 *                   - id: 8
 *                     categoryId: 1
 *                     seriesId: null
 *                     name: 공모전 마감
 *                     dateType: SINGLE
 *                     startDate: '2026-08-10'
 *                     endDate: null
 *                     isCompleted: false
 *                   - id: 12
 *                     categoryId: 3
 *                     seriesId: null
 *                     name: 개발 기간
 *                     dateType: RANGE
 *                     startDate: '2026-07-28'
 *                     endDate: '2026-08-14'
 *                     isCompleted: false
 *       400:
 *         description: baseDate 형식 오류 또는 존재하지 않는 날짜
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               invalidFormat:
 *                 summary: YYYY-MM-DD 형식이 아님 (예 - '2026-08')
 *                 value:
 *                   success: false
 *                   message: baseDate는 YYYY-MM-DD 형식이어야 합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidDate:
 *                 summary: 형식은 맞지만 존재하지 않는 날짜 (예 - '2026-02-30')
 *                 value:
 *                   success: false
 *                   message: 유효하지 않은 baseDate입니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/milestones', getMonthlyMilestones);

/**
 * @swagger
 * /users/{userId}/categories/{categoryId}/milestones:
 *   get:
 *     summary: 친구 마일스톤 목록 조회 (#64·PLB-040)
 *     description: >
 *       친구(수락된 팔로우) 또는 본인의 공개 카테고리에 속한 마일스톤을 D-Day 가까운 순(오름차순)으로 조회합니다.
 *       비공개이거나 접근 권한이 없으면 404를 반환합니다. 친구가 아닌 유저의 프로필은 조회할 수 없습니다(403).
 *
 *       조회 가능한 카테고리 범위는 `GET /users/{userId}/categories`(친구 카테고리 목록)와 동일합니다 —
 *       대상 유저가 소유한 공개 카테고리와, 대상 유저가 멤버로 참여 중인 공개 공유 카테고리(오너도 요청자와 친구인 경우)입니다.
 *       목록에 내려간 categoryId는 이 API로 그대로 열 수 있습니다.
 *
 *       내려가는 범위는 카테고리 소유자에 따라 갈립니다. 이 화면이 "대상 유저의 일정을 보는" 용도라
 *       무엇을 대상 유저의 것으로 볼지(귀속)를 기준으로 나눈 것입니다.
 *       - **대상 유저가 소유한 카테고리**: 그 안의 마일스톤이 작성자 구분 없이 전부 내려갑니다.
 *         카테고리 자체가 대상 유저의 것이므로 내용도 대상 유저에게 귀속시킵니다.
 *       - **대상 유저가 멤버로 참여 중인 남의 공유 카테고리**: 대상 유저가 작성한 마일스톤만 내려갑니다.
 *         카테고리를 통째로 열면 오너와 다른 멤버의 마일스톤까지 남의 프로필에 딸려 나가기 때문입니다.
 *         createdByUserId가 null인 마일스톤(작성자 필드 도입 이전 생성분·작성자 탈퇴)은 제외됩니다.
 *     tags: [Milestone]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 마일스톤을 조회할 대상 사용자 ID
 *         example: 2
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 친구가 아니어서 조회 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 친구의 프로필만 조회할 수 있습니다.
 *               error:
 *                 code: COMMON_FORBIDDEN
 *       404:
 *         description: 유저 또는 공개 카테고리를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 카테고리를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/users/:userId/categories/:categoryId/milestones',
  authMiddleware,
  getFriendMilestones,
);

/**
 * @swagger
 * /categories/{categoryId}/milestones:
 *   post:
 *     summary: 마일스톤 생성 (PLB-012)
 *     description: >
 *       카테고리 하위에 마일스톤을 생성합니다. 날짜는 단일(SINGLE)/기간(RANGE)/다중(MULTIPLE)으로 지정합니다.
 *       MULTIPLE는 dates 배열의 날짜마다 회차 row를 일괄 생성하고 같은 seriesId를 부여합니다(요일 반복 개념 없음).
 *       이름 중복이 허용되며, 같은 카테고리 안에서 기간이 중복될 수 있습니다.
 *       마일스톤은 카테고리와 같은 계열 색상으로 표기되고(색상 필드 없음), 생성 시 기본 상태는 "미완료"입니다.
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
 *             required: [name, dateType]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 중복 허용
 *                 example: 개발 기간
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE, MULTIPLE]
 *                 example: RANGE
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: SINGLE/RANGE 필수 (YYYY-MM-DD). MULTIPLE에서는 dates를 대신 사용
 *                 example: '2026-07-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: RANGE일 때만 사용 (YYYY-MM-DD). SINGLE/MULTIPLE에서는 지정 불가
 *                 example: '2026-07-20'
 *               dates:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: string
 *                   format: date
 *                 description: MULTIPLE 필수 — 캘린더에서 선택한 날짜 배열(중복 불가, 최대 100개). 날짜마다 회차 row가 생성됨
 *                 example: null
 *           examples:
 *             single:
 *               summary: 단일 날짜
 *               value:
 *                 name: 공모전 마감
 *                 dateType: SINGLE
 *                 startDate: '2026-07-10'
 *             range:
 *               summary: 기간
 *               value:
 *                 name: 개발 기간
 *                 dateType: RANGE
 *                 startDate: '2026-07-01'
 *                 endDate: '2026-07-20'
 *             multiple:
 *               summary: 다중 날짜 (날짜마다 회차 row 생성)
 *               value:
 *                 name: 주간 회의
 *                 dateType: MULTIPLE
 *                 dates: ['2026-07-21', '2026-07-28', '2026-08-04']
 *     responses:
 *       201:
 *         description: 마일스톤 생성 성공. 생성된 마일스톤을 배열로 반환합니다(SINGLE/RANGE는 1건, MULTIPLE는 회차 전체 — 같은 seriesId 공유).
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
 *       같은 카테고리 내에서 마일스톤 순서를 변경합니다.
 *       이 엔드포인트로는 카테고리를 넘나들 수 없습니다 — 카테고리 이동은 PATCH /milestones/{milestoneId}에 categoryId를 보내는 방식입니다(#86).
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
 *       다중(MULTIPLE) 마일스톤은 회차마다 실제 row로 존재하며, "이름"을 수정할 때는 editScope로
 *       "이 항목만 수정 / 전체 수정"을 반드시 지정합니다(기본값 없음, 둘 중 택1).
 *       editScope=THIS_ONLY → URL로 지정한 회차 row 1건만 수정,
 *       editScope=ALL → 지정 회차 + 같은 seriesId 중 "오늘 이후 + 미완료" 회차에 이름 일괄 반영
 *       (완료된 과거 회차는 보존, PLB-013).
 *       날짜(startDate) 변경은 모달 없이 항상 해당 회차 1건만 이동하고(PLB-013),
 *       완료(isCompleted)는 회차별 독립 기록이므로 둘 다 editScope 없이 요청합니다.
 *       SINGLE/RANGE 마일스톤에는 editScope를 지정할 수 없습니다.
 *
 *       dateType을 함께 보내면 "날짜 타입 변경" 모드로 동작합니다(#84). 하루/기간/다중 6가지 전환을 모두 지원하며,
 *       같은 타입을 다시 지정해도 날짜는 통째로 새로 설정됩니다.
 *       URL로 지정한 마일스톤을 그대로 갱신하므로 milestoneId는 유지되며, 하위 태스크와 완료 여부도 보존됩니다
 *       (태스크 수정이 taskId를 유지하는 것과 동일한 방식).
 *       단, 표시 순서(displayOrder)는 새 날짜 기준 D-Day 위치로 다시 잡힙니다.
 *       MULTIPLE에서 다른 타입으로 바꾸면 같은 seriesId의 나머지 회차는 정리되고(완료된 과거 회차 포함),
 *       정리되는 회차에 달려 있던 태스크는 삭제되지 않고 지정한 마일스톤으로 이관됩니다.
 *       MULTIPLE로 바꾸면 지정한 마일스톤이 가장 이른 날짜의 첫 회차가 되고 나머지 날짜의 회차가 추가 생성됩니다.
 *       이 모드에서는 editScope·isCompleted를 함께 보낼 수 없고, 날짜 필드 조합은 생성과 동일한 규칙을 따릅니다
 *       (SINGLE=startDate / RANGE=startDate+endDate / MULTIPLE=dates).
 *
 *
 *
 *
 *       현재 소속과 다른 categoryId를 보내면 카테고리 이동으로 동작합니다(#86). 이름·날짜 수정과 함께 보낼 수 있으며,
 *       이름·날짜를 먼저 반영한 뒤 이동하므로 바뀐 날짜 기준으로 대상 카테고리의 표시 순서가 정해집니다.
 *       대상 카테고리는 본인이 접근할 수 있어야 하고(없으면 404, 권한이 없으면 403), 검증은 수정 전에
 *       이루어지므로 실패하면 이름·날짜도 바뀌지 않습니다.
 *       단, 공유 카테고리의 마일스톤을 다른 카테고리로 옮기는 것은 오너만 가능합니다(멤버가 시도하면 403) —
 *       옮기고 나면 나머지 멤버의 목록에서 사라져 그들에게는 삭제와 같은 효과이기 때문입니다.
 *       멤버는 공유 카테고리 안에서의 수정은 그대로 할 수 있습니다.
 *       하위 태스크도 같은 카테고리로 함께 이동하며(태스크 생성이 "마일스톤이 그 카테고리에 속하는지"를 검증하기 때문),
 *       taskId·milestoneId·태스크 날짜는 그대로 유지됩니다.
 *       MULTIPLE는 회차가 흩어지면 안 되므로 editScope와 무관하게 같은 seriesId의 회차 전체가 함께 이동합니다.
 *       표시 순서(displayOrder)는 대상 카테고리 안에서 D-Day 순 위치로 다시 부여됩니다.
 *       숨김 카테고리로 옮기면 하위 태스크도 캘린더에서 함께 숨겨지고, 태스크 색상은 새 카테고리 색상으로 표시됩니다.
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
 *                 description: 변경할 이름 (중복 허용). MULTIPLE에서는 editScope 필수. 날짜 타입 변경 모드에서 생략하면 기존 이름이 유지됨
 *               categoryId:
 *                 type: integer
 *                 description: >
 *                   옮길 카테고리 ID(#86). 현재 소속과 다르면 카테고리 이동이 수행되고, 같은 값이면 변경 없이 통과합니다
 *                   (수정 모달이 폼 전체를 보내는 경우). 이 필드만 단독으로 보내도 유효한 수정 요청입니다.
 *                   접근 권한이 없으면 403, 존재하지 않으면 404. 공유 카테고리에서 밖으로 옮기는 것은 오너만 가능합니다.
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE, MULTIPLE]
 *                 description: '지정 시 날짜 타입 변경 모드로 동작함(#84). 생략하면 기존 날짜 타입을 유지한 부분 수정'
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: 날짜 변경 (YYYY-MM-DD, null 불가). MULTIPLE 회차 row에서는 해당 회차의 날짜이며 editScope 없이 이 회차 1건만 이동 (PLB-013). 날짜 타입 변경 모드에서는 SINGLE/RANGE 필수
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 날짜 변경 (RANGE일 때). 날짜 타입 변경 모드에서는 RANGE 필수
 *               dates:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: string
 *                   format: date
 *                 description: 날짜 타입 변경 모드에서 MULTIPLE 필수 — 선택한 날짜 배열(중복 불가, 최대 100개). dateType 없이 단독으로 보내면 400
 *               isCompleted:
 *                 type: boolean
 *                 description: 완료/미완료 토글 (회차 row별 독립 기록, editScope 불필요). 날짜 타입 변경 시에는 완료 여부가 그대로 보존되므로 함께 보낼 수 없음
 *               editScope:
 *                 type: string
 *                 enum: [THIS_ONLY, ALL]
 *                 description: 'MULTIPLE 이름 수정 전용 필수 택1. THIS_ONLY=이 회차 1건 / ALL=이 회차 + 같은 seriesId의 오늘 이후 미완료 회차에 이름 일괄 반영. 그 외 상황(날짜 타입 변경 모드 포함)에서 지정 시 400'
 *           examples:
 *             completeToggle:
 *               summary: 완료 처리 (scope 없이, 회차별 독립)
 *               value:
 *                 isCompleted: true
 *             thisOnly:
 *               summary: 다중 중 이 회차만 이름 수정
 *               value:
 *                 editScope: THIS_ONLY
 *                 name: 긴급 회의
 *             editAll:
 *               summary: 전체 수정 (이 회차 + 오늘 이후 미완료 회차 이름 일괄)
 *               value:
 *                 editScope: ALL
 *                 name: 주간 회의
 *             toSingle:
 *               summary: 날짜 타입 변경 - 하루로
 *               value:
 *                 dateType: SINGLE
 *                 startDate: '2026-07-15'
 *             toRange:
 *               summary: 날짜 타입 변경 - 기간으로 (이름도 함께 변경)
 *               value:
 *                 name: 굿즈 제작
 *                 dateType: RANGE
 *                 startDate: '2026-07-27'
 *                 endDate: '2026-08-01'
 *             toMultiple:
 *               summary: 날짜 타입 변경 - 다중으로 (날짜마다 회차 row 생성)
 *               value:
 *                 dateType: MULTIPLE
 *                 dates: ['2026-07-06', '2026-07-13', '2026-07-20']
 *             moveCategory:
 *               summary: 카테고리 이동 (하위 태스크 동반, MULTIPLE은 회차 전체)
 *               value:
 *                 categoryId: 7
 *             moveWithRename:
 *               summary: 카테고리 이동 + 이름 변경 (수정 모달 폼 전체 전송)
 *               value:
 *                 categoryId: 7
 *                 name: 굿즈 제작
 *     responses:
 *       200:
 *         description: >
 *           수정 성공. 수정된 마일스톤 1건을 반환합니다(milestoneId는 항상 유지).
 *           editScope=ALL이어도 URL로 지정한 회차 기준으로 응답하며 나머지 회차에 이름은 반영됩니다.
 *           MULTIPLE로 날짜 타입을 바꾼 경우에만 series 필드에 회차 전체가 날짜 오름차순으로 함께 담깁니다
 *           (태스크 수정 응답의 taskDates에 대응).
 *           카테고리를 이동한 경우 categoryId와 displayOrder가 새 카테고리 기준 값으로 반영됩니다.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Milestone'
 *                         - type: object
 *                           properties:
 *                             series:
 *                               type: array
 *                               description: MULTIPLE로 변경한 응답에만 존재. 같은 seriesId 회차 전체(날짜 오름차순, 0번이 지정한 마일스톤)
 *                               items:
 *                                 $ref: '#/components/schemas/Milestone'
 *             examples:
 *               toRange:
 *                 summary: 기간으로 변경 (id 유지)
 *                 value:
 *                   success: true
 *                   message: 마일스톤 수정 성공
 *                   data:
 *                     id: 42
 *                     seriesId: null
 *                     name: 굿즈 제작
 *                     dateType: RANGE
 *                     startDate: '2026-07-27'
 *                     endDate: '2026-08-01'
 *                     isCompleted: false
 *               toMultiple:
 *                 summary: 다중으로 변경 (id 유지 + 회차 전체 동봉)
 *                 value:
 *                   success: true
 *                   message: 마일스톤 수정 성공
 *                   data:
 *                     id: 42
 *                     seriesId: 42
 *                     name: 주간 회의
 *                     dateType: MULTIPLE
 *                     startDate: '2026-07-06'
 *                     endDate: null
 *                     isCompleted: false
 *                     series:
 *                       - id: 42
 *                         seriesId: 42
 *                         dateType: MULTIPLE
 *                         startDate: '2026-07-06'
 *                       - id: 88
 *                         seriesId: 42
 *                         dateType: MULTIPLE
 *                         startDate: '2026-07-13'
 *       400:
 *         description: MULTIPLE 이름 수정인데 editScope 누락, 이름 변경 없이 editScope 지정, SINGLE/RANGE에 editScope 지정, dateType과 날짜 필드 조합 불일치, 날짜 타입 변경에 editScope·isCompleted 동반, 또는 수정할 값이 하나도 없음
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
 *       403:
 *         description: 접근 권한이 없는 마일스톤을 수정하거나 접근 권한이 없는 카테고리로 이동을 시도한 경우, 또는 공유 카테고리의 마일스톤을 오너가 아닌 멤버가 다른 카테고리로 옮기려 한 경우
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 해당 카테고리에 접근할 권한이 없습니다.
 *               error:
 *                 code: COMMON_FORBIDDEN
 *       404:
 *         description: 마일스톤 또는 이동할 대상 카테고리를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 카테고리를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
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
 *       마일스톤을 삭제합니다. **하위 태스크는 함께 삭제되지 않습니다** — 완료 여부와 무관하게
 *       모두 살아남아 해당 카테고리의 직속 태스크가 됩니다(응답의 milestoneId가 null로 바뀝니다).
 *       화면에서는 마일스톤 하위가 아니라 카테고리 바로 아래에 표시하면 됩니다.
 *       옮겨진 태스크는 기존 직속 태스크 뒤에 붙고 서로의 상대 순서는 유지됩니다.
 *       다중(MULTIPLE) 마일스톤은 deleteScope로 "이 항목만 삭제 / 전체 삭제"를 반드시 지정합니다(기본값 없음, 둘 중 택1).
 *       deleteScope=THIS_ONLY → URL로 지정한 회차 row 1건만 삭제,
 *       deleteScope=ALL → 지정 회차 + 같은 seriesId 중 "오늘 이후 + 미완료" 회차 일괄 삭제
 *       (완료된 과거 회차는 보존, PLB-014). 이 경우 정리되는 회차 전부의 하위 태스크가 직속으로 내려옵니다.
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
 *         description: 'MULTIPLE 삭제 시 필수 택1. THIS_ONLY=이 회차 1건 / ALL=이 회차 + 같은 seriesId의 오늘 이후 미완료 회차 일괄. SINGLE/RANGE에 지정 시 400'
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
 *         description: MULTIPLE인데 deleteScope 누락·잘못된 값, 또는 SINGLE/RANGE에 deleteScope 지정
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
