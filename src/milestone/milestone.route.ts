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
 *   description: 마일스톤 (카테고리 하위 계층, userId 없이 카테고리로 소유 판정)
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
 * /users/{userId}/categories/{categoryId}/milestones:
 *   get:
 *     summary: 친구 마일스톤 목록 조회 (#64·PLB-040)
 *     description: >
 *       친구(수락된 팔로우) 또는 본인의 공개 카테고리에 속한 마일스톤을 D-Day 가까운 순(오름차순)으로 조회합니다.
 *       대상 카테고리가 공개(isPublic=true)이며 대상 유저 소유일 때만 조회되고,
 *       비공개이거나 존재하지 않으면 404를 반환합니다. 친구가 아닌 유저의 프로필은 조회할 수 없습니다(403).
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
 *                   카테고리 이동은 이 엔드포인트에서 아직 지원하지 않습니다(별도 이슈로 진행 예정).
 *                   수정 모달이 폼 전체를 보내는 경우를 위해 필드는 받지만, 현재 소속 카테고리와 같은 값일 때만
 *                   통과하고 다른 값이면 400을 반환합니다. 조용히 무시되지 않으므로 이동 시도는 즉시 드러납니다.
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
 *     responses:
 *       200:
 *         description: >
 *           수정 성공. 수정된 마일스톤 1건을 반환합니다(milestoneId는 항상 유지).
 *           editScope=ALL이어도 URL로 지정한 회차 기준으로 응답하며 나머지 회차에 이름은 반영됩니다.
 *           MULTIPLE로 날짜 타입을 바꾼 경우에만 series 필드에 회차 전체가 날짜 오름차순으로 함께 담깁니다
 *           (태스크 수정 응답의 taskDates에 대응).
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
 *         description: MULTIPLE 이름 수정인데 editScope 누락, 이름 변경 없이 editScope 지정, SINGLE/RANGE에 editScope 지정, dateType과 날짜 필드 조합 불일치, 날짜 타입 변경에 editScope·isCompleted 동반, 현재와 다른 categoryId 지정(카테고리 이동 미지원), 또는 수정할 값이 하나도 없음
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
 *       다중(MULTIPLE) 마일스톤은 deleteScope로 "이 항목만 삭제 / 전체 삭제"를 반드시 지정합니다(기본값 없음, 둘 중 택1).
 *       deleteScope=THIS_ONLY → URL로 지정한 회차 row 1건만 삭제,
 *       deleteScope=ALL → 지정 회차 + 같은 seriesId 중 "오늘 이후 + 미완료" 회차 일괄 삭제
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
