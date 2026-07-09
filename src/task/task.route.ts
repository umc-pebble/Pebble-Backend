import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  toggleTaskComplete,
  deleteTask,
  reorderTasks,
} from './task.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Task
 *   description: 태스크 (마일스톤 종속 또는 단일 인박스). milestoneId=null 이면 카테고리 계층 밖 개인 인박스.
 */

/**
 * @swagger
 * /milestones/{milestoneId}/tasks:
 *   get:
 *     summary: 종속 태스크 목록 조회 (PLB-020·021)
 *     description: >
 *       마일스톤에 속한 종속 태스크를 D-Day 가까운 순(오름차순)으로 조회합니다.
 *       상위 카테고리가 숨김 처리된 경우 태스크도 캘린더에서 함께 숨겨지며, 태스크 개별 숨김은 불가능합니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/MilestoneIdPath'
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
 *                         tasks:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Task'
 *             example:
 *               success: true
 *               message: 태스크 조회 성공
 *               data:
 *                 tasks:
 *                   - id: 12
 *                     name: 기획서 작성
 *                     dateType: SINGLE
 *                     startDate: '2026-07-01'
 *                     taskTime: '14:00'
 *                     memo: 초안까지
 *                     isCompleted: false
 *                     color: '#FFB4B4'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/milestones/:milestoneId/tasks', getTasks);

/**
 * @swagger
 * /tasks/order:
 *   patch:
 *     summary: 태스크 순서 변경 (PLB-021)
 *     description: >
 *       같은 마일스톤 내에서 태스크 순서를 변경합니다. 마일스톤 간 이동은 불가합니다.
 *       기본 정렬은 D-Day 가까운 순(오름차순)이며, 드래그 앤 드롭 결과를 orderedIds로 전달합니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [milestoneId, orderedIds]
 *             properties:
 *               milestoneId:
 *                 type: integer
 *                 description: 대상 마일스톤 id
 *                 example: 10
 *               orderedIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 화면 순서대로 나열한 taskId 배열
 *                 example: [102, 100, 101]
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
 *         description: 다른 마일스톤의 태스크 ID 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 다른 마일스톤의 태스크가 포함되어 있습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/tasks/order', reorderTasks);

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: 태스크 생성 — 종속/단일 (PLB-017)
 *     description: >
 *       태스크를 생성합니다. milestoneId가 있으면 종속 태스크, null이거나 생략하면 단일(인박스) 태스크로 처리됩니다.
 *       종속 태스크는 상위 카테고리와 같은 계열 색상으로 표기되어 color를 지정하지 않으며,
 *       단일 태스크만 별도의 색상을 설정할 수 있습니다.
 *       날짜는 단일/기간/반복요일 중 하나로 지정하고, 생성 시 기본 상태는 "미완료"입니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, dateType]
 *             properties:
 *               milestoneId:
 *                 type: integer
 *                 nullable: true
 *                 description: 종속 시 필수, 단일 시 null 또는 생략
 *                 example: 10
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 중복 허용
 *                 example: 기획서 작성
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE, REPEAT]
 *                 example: SINGLE
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: SINGLE/RANGE일 때 사용 (YYYY-MM-DD)
 *                 example: '2026-07-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: RANGE일 때 사용 (YYYY-MM-DD)
 *               repeatDays:
 *                 type: string
 *                 maxLength: 30
 *                 nullable: true
 *                 description: 'REPEAT일 때 반복 요일 (예: MON,WED)'
 *               taskTime:
 *                 type: string
 *                 nullable: true
 *                 description: 태스크 시간 (HH:mm)
 *                 example: '14:00'
 *               memo:
 *                 type: string
 *                 nullable: true
 *                 example: 초안까지
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 description: 단일 태스크만 사용 (종속 태스크는 카테고리 계열색)
 *     responses:
 *       201:
 *         description: 태스크 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Task'
 *             example:
 *               success: true
 *               message: 태스크 생성 성공
 *               data:
 *                 id: 12
 *                 name: 기획서 작성
 *                 isCompleted: false
 *       400:
 *         description: 입력값 오류 (dateType과 날짜 필드 조합 불일치, 종속인데 마일스톤 없음 등)
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
 *         description: milestoneId에 해당하는 마일스톤 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 마일스톤을 찾을 수 없습니다.

 *               error:

 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/tasks', createTask);

/**
 * @swagger
 * /tasks/{taskId}:
 *   patch:
 *     summary: 태스크 수정 (PLB-017·018)
 *     description: >
 *       태스크 이름·날짜·시간·메모를 수정합니다. 단일 태스크는 색상도 수정할 수 있습니다.
 *       반복(REPEAT) 태스크 수정 시 editScope로 "이 항목만 수정 / 전체 수정"을 지정합니다.
 *       editScope=ALL(기본) → 마스터 레코드 직접 수정,
 *       editScope=THIS_ONLY → originalDate로 지정한 회차만 TaskException에 upsert(originalDate 필수).
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
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
 *                 enum: [SINGLE, RANGE, REPEAT]
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 날짜 변경 (editScope=ALL일 때)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 날짜 변경 (editScope=ALL일 때)
 *               repeatDays:
 *                 type: string
 *                 maxLength: 30
 *                 nullable: true
 *               taskTime:
 *                 type: string
 *                 nullable: true
 *                 description: 시간 변경 (HH:mm)
 *               memo:
 *                 type: string
 *                 nullable: true
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 description: 단일 태스크만 수정 가능
 *               editScope:
 *                 type: string
 *                 enum: [ALL, THIS_ONLY]
 *                 default: ALL
 *                 description: REPEAT 태스크 수정 범위
 *               originalDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: editScope=THIS_ONLY일 때 필수. 예외 처리할 회차의 원 날짜
 *           examples:
 *             normalEdit:
 *               summary: 일반 수정
 *               value:
 *                 name: 기획서 최종본
 *                 taskTime: '16:00'
 *             thisOnly:
 *               summary: 반복 중 이 회차만 수정
 *               value:
 *                 editScope: THIS_ONLY
 *                 originalDate: '2026-07-14'
 *                 memo: 이번 주만 온라인 진행
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Task'
 *       400:
 *         description: editScope=THIS_ONLY인데 originalDate 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 이 회차만 수정하려면 originalDate가 필요합니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/tasks/:taskId', updateTask);

/**
 * @swagger
 * /tasks/{taskId}/complete:
 *   patch:
 *     summary: 태스크 완료 토글 (PLB-017·022)
 *     description: >
 *       태스크 완료/완료취소를 토글합니다. 완료 시 completedAt이 기록됩니다.
 *       SINGLE/RANGE 태스크는 Task 본체를 토글하고,
 *       REPEAT 태스크는 originalDate 쿼리 파라미터로 회차를 지정해 TaskException에 기록합니다(originalDate 필수).
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
 *       - name: originalDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: dateType=REPEAT일 때 필수. 완료 토글할 회차의 원 날짜 (YYYY-MM-DD)
 *         example: '2026-07-14'
 *     responses:
 *       200:
 *         description: 완료 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Task'
 *             examples:
 *               singleOrRange:
 *                 summary: SINGLE/RANGE 태스크
 *                 value:
 *                   success: true
 *                   message: 완료 처리 성공
 *                   data:
 *                     id: 12
 *                     isCompleted: true
 *                     completedAt: '2026-06-30T14:20:00+09:00'
 *               repeatOccurrence:
 *                 summary: REPEAT 태스크 회차
 *                 value:
 *                   success: true
 *                   message: 완료 처리 성공
 *                   data:
 *                     id: 20
 *                     originalDate: '2026-07-14'
 *                     isCompleted: true
 *                     completedAt: '2026-07-14T09:10:00+09:00'
 *       400:
 *         description: REPEAT 태스크인데 originalDate 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 반복 태스크는 originalDate가 필요합니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/tasks/:taskId/complete', toggleTaskComplete);

/**
 * @swagger
 * /tasks/{taskId}:
 *   delete:
 *     summary: 태스크 삭제 (PLB-019)
 *     description: >
 *       태스크를 삭제합니다. 하위 TaskException이 함께 삭제(CASCADE)되며 복구할 수 없습니다.
 *       완료 상태였다면 해당 날짜의 징검다리(ActivityLog) 카운트가 -1 재계산됩니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: 태스크 삭제 성공
 *               data: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/tasks/:taskId', deleteTask);

export default router;
