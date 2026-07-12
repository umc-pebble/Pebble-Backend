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
 *   description: 태스크 (마일스톤 하위 또는 독립, 다중 날짜는 TaskDate로 회차 관리)
 */

/**
 * @swagger
 * /milestones/{milestoneId}/tasks:
 *   get:
 *     summary: 하위 태스크 목록 조회 (PLB-020·021)
 *     description: >
 *       특정 마일스톤에 속한 하위 태스크 목록을 조회합니다.
 *       기본 정렬은 D-Day가 가까운 순(오름차순)입니다.
 *       사용자가 순서를 직접 변경한 경우 저장된 displayOrder 순서대로 조회합니다.
 *       상위 카테고리가 숨김 처리된 경우 캘린더에 노출되지 않습니다.
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
 *                     userId: 1
 *                     milestoneId: 10
 *                     name: 기획서 작성
 *                     dateType: SINGLE
 *                     startDate: '2026-07-01'
 *                     endDate: null
 *                     dates: null
 *                     color: null
 *                     isCompleted: false
 *                     completedAt: null
 *                     displayOrder: 1
 *                   - id: 30
 *                     userId: 1
 *                     milestoneId: 10
 *                     name: 운동하기
 *                     dateType: MULTI
 *                     startDate: null
 *                     endDate: null
 *                     dates:
 *                       - taskDateId: 101
 *                         date: '2026-07-10'
 *                         isCompleted: true
 *                         completedAt: '2026-07-10T09:10:00+09:00'
 *                         name: 운동하기
 *                         color: null
 *                       - taskDateId: 102
 *                         date: '2026-07-14'
 *                         isCompleted: false
 *                         completedAt: null
 *                         name: 운동하기
 *                         color: null
 *                     color: null
 *                     isCompleted: false
 *                     completedAt: null
 *                     displayOrder: 2
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/milestones/:milestoneId/tasks', getTasks);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: 독립 태스크 목록 조회 (PLB-020·021)
 *     description: >
 *       독립 태스크 목록을 조회합니다.
 *       독립 태스크는 마일스톤에 속하지 않는 태스크이며, 캘린더 사이드바 상단에 표시됩니다.
 *       독립 태스크도 날짜 유형으로 일반(SINGLE), 기간(RANGE), 다중(MULTI)을 가질 수 있습니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: baseDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 기준 날짜. 미입력 시 오늘 기준
 *         example: '2026-07-10'
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
 *               message: 독립 태스크 조회 성공
 *               data:
 *                 tasks:
 *                   - id: 21
 *                     userId: 1
 *                     milestoneId: null
 *                     name: 장보기
 *                     dateType: SINGLE
 *                     startDate: '2026-07-10'
 *                     endDate: null
 *                     dates: null
 *                     color: '#A5B4FC'
 *                     isCompleted: false
 *                     completedAt: null
 *                     displayOrder: 1
 *                   - id: 22
 *                     userId: 1
 *                     milestoneId: null
 *                     name: 여행 준비
 *                     dateType: RANGE
 *                     startDate: '2026-07-10'
 *                     endDate: '2026-07-20'
 *                     dates: null
 *                     color: '#F9A8D4'
 *                     isCompleted: false
 *                     completedAt: null
 *                     displayOrder: 2
 *                   - id: 23
 *                     userId: 1
 *                     milestoneId: null
 *                     name: 운동하기
 *                     dateType: MULTI
 *                     startDate: null
 *                     endDate: null
 *                     dates:
 *                       - taskDateId: 201
 *                         date: '2026-07-10'
 *                         isCompleted: false
 *                         completedAt: null
 *                         name: 운동하기
 *                         color: '#86EFAC'
 *                       - taskDateId: 202
 *                         date: '2026-07-14'
 *                         isCompleted: true
 *                         completedAt: '2026-07-14T09:10:00+09:00'
 *                         name: 운동하기
 *                         color: '#86EFAC'
 *                     color: '#86EFAC'
 *                     isCompleted: false
 *                     completedAt: null
 *                     displayOrder: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/tasks', getTasks);

/**
 * @swagger
 * /tasks/order:
 *   patch:
 *     summary: 하위 태스크 순서 변경 (PLB-021)
 *     description: >
 *       같은 마일스톤 내에서 태스크 순서를 변경합니다.
 *       전달된 orderedIds 순서가 displayOrder로 저장되며, 이후 하위 태스크 목록 조회 시 해당 순서가 반영됩니다.
 *       다른 마일스톤으로의 이동은 지원하지 않습니다.
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
 *                 description: 대상 마일스톤 ID
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
 *         description: 다른 마일스톤의 태스크 ID가 포함된 경우
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     summary: 태스크 생성 — 독립/하위 (PLB-017)
 *     description: >
 *       태스크를 생성합니다. milestoneId가 없으면 독립 태스크, 있으면 마일스톤 하위 태스크로 생성합니다.
 *       독립 태스크와 하위 태스크 모두 날짜 유형으로 SINGLE(일반), RANGE(기간), MULTI(다중) 중 하나를 선택할 수 있습니다.
 *       색상은 독립 태스크만 설정할 수 있으며(사용자가 설정하지 않을 경우 기본값을 전달), 하위 태스크는 상위 카테고리 색상을 따릅니다.
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
 *                 description: 하위 태스크일 경우 마일스톤 ID, 독립 태스크일 경우 null 또는 생략
 *                 example: 10
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 태스크 이름. 중복 허용
 *                 example: 기획서 작성
 *               dateType:
 *                 type: string
 *                 enum: [SINGLE, RANGE, MULTI]
 *                 description: 날짜 유형. 생성 이후 변경할 수 없습니다.
 *                 example: SINGLE
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: SINGLE/RANGE에서 사용하는 시작 날짜
 *                 example: '2026-07-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: RANGE에서 사용하는 종료 날짜
 *                 example: '2026-07-10'
 *               dates:
 *                 type: array
 *                 nullable: true
 *                 description: MULTI에서 사용하는 날짜 배열. 각 날짜는 TaskDate로 생성됩니다.
 *                 items:
 *                   type: string
 *                   format: date
 *                 example: ['2026-07-10', '2026-07-14', '2026-07-20']
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 description: >
 *                   독립 태스크만 사용합니다.
 *                   독립 태스크에서 미지정 시 기본 색상으로 설정됩니다.
 *                   하위 태스크 생성 시 color를 전달하면 400 Bad Request를 반환합니다.
 *                 example: '#A5B4FC'
 *           examples:
 *             independentSingleTask:
 *               summary: 독립 태스크 생성 - 일반 날짜
 *               value:
 *                 name: 장보기
 *                 dateType: SINGLE
 *                 startDate: '2026-07-10'
 *                 color: '#A5B4FC'
 *             independentRangeTask:
 *               summary: 독립 태스크 생성 - 기간
 *               value:
 *                 name: 여행 준비
 *                 dateType: RANGE
 *                 startDate: '2026-07-10'
 *                 endDate: '2026-07-20'
 *                 color: '#A5B4FC'
 *             independentMultiTask:
 *               summary: 독립 태스크 생성 - 다중 날짜
 *               value:
 *                 name: 운동하기
 *                 dateType: MULTI
 *                 dates: ['2026-07-10', '2026-07-14', '2026-07-20']
 *                 color: '#A5B4FC'
 *             childSingleTask:
 *               summary: 하위 태스크 생성 - 일반 날짜
 *               value:
 *                 milestoneId: 10
 *                 name: 기획서 작성
 *                 dateType: SINGLE
 *                 startDate: '2026-07-10'
 *             childRangeTask:
 *               summary: 하위 태스크 생성 - 기간
 *               value:
 *                 milestoneId: 10
 *                 name: 기획서 작성
 *                 dateType: RANGE
 *                 startDate: '2026-07-10'
 *                 endDate: '2026-07-20'
 *             childMultiTask:
 *               summary: 하위 태스크 생성 - 다중 날짜
 *               value:
 *                 milestoneId: 10
 *                 name: 자료 조사
 *                 dateType: MULTI
 *                 dates: ['2026-07-10', '2026-07-14', '2026-07-20']
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
 *                       type: object
 *             examples:
 *               independentSingleTask:
 *                 summary: 독립 일반 날짜 태스크 생성 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 생성 성공
 *                   data:
 *                     id: 12
 *                     userId: 1
 *                     milestoneId: null
 *                     name: 장보기
 *                     dateType: SINGLE
 *                     startDate: '2026-07-10'
 *                     endDate: null
 *                     color: '#A5B4FC'
 *                     isCompleted: false
 *                     completedAt: null
 *               childRangeTask:
 *                 summary: 하위 기간 태스크 생성 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 생성 성공
 *                   data:
 *                     id: 20
 *                     userId: 1
 *                     milestoneId: 10
 *                     name: 기획서 작성
 *                     dateType: RANGE
 *                     startDate: '2026-07-10'
 *                     endDate: '2026-07-20'
 *                     color: null
 *                     isCompleted: false
 *                     completedAt: null
 *               childMultiTask:
 *                 summary: 하위 다중 날짜 태스크 생성 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 생성 성공
 *                   data:
 *                     id: 30
 *                     userId: 1
 *                     milestoneId: 10
 *                     name: 자료 조사
 *                     dateType: MULTI
 *                     startDate: null
 *                     endDate: null
 *                     color: null
 *                     taskDates:
 *                       - id: 101
 *                         date: '2026-07-10'
 *                         isCompleted: false
 *                         completedAt: null
 *                       - id: 102
 *                         date: '2026-07-14'
 *                         isCompleted: false
 *                         completedAt: null
 *       400:
 *         description: 입력값 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               invalidInput:
 *                 summary: 입력값 오류
 *                 value:
 *                   success: false
 *                   message: 요청 값이 올바르지 않습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidDateFields:
 *                 summary: dateType과 날짜 필드 조합 오류
 *                 value:
 *                   success: false
 *                   message: dateType과 날짜 필드 조합이 올바르지 않습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               childTaskWithColor:
 *                 summary: 하위 태스크에 color 전달
 *                 value:
 *                   success: false
 *                   message: 하위 태스크에는 color를 지정할 수 없습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: milestoneId에 해당하는 마일스톤이 없는 경우
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
 *     summary: 태스크 수정 (PLB-018)
 *     description: >
 *       태스크 정보를 수정합니다. dateType과 소속 마일스톤은 변경할 수 없습니다.
 *       다중 태스크의 이름/색상 수정은 editScope로 이 항목만 수정할지 전체 수정할지 지정합니다.
 *       날짜 수정은 editScope를 사용하지 않고 현재 dateType에 맞는 날짜 필드를 직접 수정합니다.
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
 *                 nullable: true
 *                 description: 변경할 태스크 이름. 중복 허용
 *                 example: 기획서 최종본 작성
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 일반/기간 태스크에서 수정 가능한 시작 날짜
 *                 example: '2026-07-11'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: 기간 태스크에서 수정 가능한 종료 날짜
 *                 example: '2026-07-20'
 *               dates:
 *                 type: array
 *                 nullable: true
 *                 description: 다중 태스크의 날짜 배열 수정. 날짜 수정은 TaskDate.date를 직접 수정하며 editScope를 사용하지 않습니다.
 *                 items:
 *                   type: string
 *                   format: date
 *                 example: ['2026-07-11', '2026-07-15', '2026-07-20']
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 description: 독립 태스크만 수정 가능
 *                 example: '#A5B4FC'
 *               editScope:
 *                 type: string
 *                 enum: [THIS_ONLY, ALL]
 *                 nullable: true
 *                 description: >
 *                   다중 태스크의 이름/색상 수정 범위입니다.
 *                   기본값은 없으며, 다중 태스크에서 name 또는 color 수정 시 필수입니다.
 *                   THIS_ONLY는 taskDateId에 해당하는 회차만 TaskException에 저장합니다.
 *                   ALL은 오늘 이후 미완료 회차에만 적용됩니다.
 *                 example: THIS_ONLY
 *               taskDateId:
 *                 type: integer
 *                 nullable: true
 *                 description: 다중 태스크에서 THIS_ONLY 수정 시 대상 회차의 TaskDate ID
 *                 example: 101
 *           examples:
 *             normalSingleEdit:
 *               summary: 일반 태스크 수정
 *               value:
 *                 name: 장보기 수정
 *                 startDate: '2026-07-11'
 *                 color: '#A5B4FC'
 *             normalRangeEdit:
 *               summary: 기간 태스크 수정
 *               value:
 *                 name: 기획서 작성
 *                 startDate: '2026-07-11'
 *                 endDate: '2026-07-20'
 *             multiDateEdit:
 *               summary: 다중 태스크 날짜 수정
 *               value:
 *                 dates: ['2026-07-11', '2026-07-15', '2026-07-20']
 *             multiThisOnlyName:
 *               summary: 다중 이 항목만 이름 수정
 *               value:
 *                 editScope: THIS_ONLY
 *                 taskDateId: 101
 *                 name: 이번 회차만 병원 가기
 *             multiAllName:
 *               summary: 다중 전체 이름 수정
 *               value:
 *                 editScope: ALL
 *                 name: 아침 운동
 *             independentMultiThisOnlyColor:
 *               summary: 독립 다중 이 항목만 색상 수정
 *               value:
 *                 editScope: THIS_ONLY
 *                 taskDateId: 101
 *                 color: '#A5B4FC'
 *             independentMultiAllColor:
 *               summary: 독립 다중 전체 색상 수정
 *               value:
 *                 editScope: ALL
 *                 color: '#A5B4FC'
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
 *                       type: object
 *             examples:
 *               normal:
 *                 summary: 일반/기간 태스크 수정 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 수정 성공
 *                   data:
 *                     id: 12
 *                     name: 기획서 최종본 작성
 *                     startDate: '2026-07-11'
 *               multiThisOnly:
 *                 summary: 다중 이 항목만 수정 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 수정 성공
 *                   data:
 *                     scope: THIS_ONLY
 *                     taskDateId: 101
 *                     exception:
 *                       name: 이번 회차만 병원 가기
 *                       color: null
 *               multiAll:
 *                 summary: 다중 전체 수정 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 수정 성공
 *                   data:
 *                     scope: ALL
 *                     affectedCount: 3
 *                     snapshottedCount: 2
 *       400:
 *         description: 입력값 오류 또는 수정 범위 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               invalidInput:
 *                 summary: 입력값 오류
 *                 value:
 *                   success: false
 *                   message: 요청 값이 올바르지 않습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidDateTypeChange:
 *                 summary: dateType 변경 시도
 *                 value:
 *                   success: false
 *                   message: dateType은 수정할 수 없습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidMilestoneChange:
 *                 summary: milestoneId 변경 시도
 *                 value:
 *                   success: false
 *                   message: 태스크의 소속 마일스톤은 수정할 수 없습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               missingEditScope:
 *                 summary: 다중 이름/색상 수정 시 editScope 누락
 *                 value:
 *                   success: false
 *                   message: 다중 태스크의 이름/색상 수정 시 editScope가 필요합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               missingTaskDateId:
 *                 summary: THIS_ONLY 수정 시 taskDateId 누락
 *                 value:
 *                   success: false
 *                   message: 이 항목만 수정하려면 taskDateId가 필요합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               childTaskWithColor:
 *                 summary: 하위 태스크에 color 전달
 *                 value:
 *                   success: false
 *                   message: 하위 태스크에는 color를 지정할 수 없습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               invalidDateFields:
 *                 summary: dateType과 날짜 필드 조합 오류
 *                 value:
 *                   success: false
 *                   message: 현재 dateType과 날짜 필드 조합이 올바르지 않습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     summary: 태스크 완료 토글 (PLB-022)
 *     description: >
 *       태스크의 완료 상태를 토글합니다.
 *       SINGLE/RANGE는 Task의 완료 상태를 변경하고, MULTI는 TaskDate의 완료 상태를 변경합니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
 *       - name: taskDateId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: MULTI 태스크에서 완료 상태를 변경할 TaskDate ID
 *         example: 101
 *     responses:
 *       200:
 *         description: 완료 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *             examples:
 *               singleOrRange:
 *                 summary: SINGLE/RANGE 완료 토글
 *                 value:
 *                   success: true
 *                   message: 완료 처리 성공
 *                   data:
 *                     id: 12
 *                     isCompleted: true
 *                     completedAt: '2026-07-10T14:20:00+09:00'
 *               multi:
 *                 summary: MULTI 날짜별 완료 토글
 *                 value:
 *                   success: true
 *                   message: 완료 처리 성공
 *                   data:
 *                     taskId: 30
 *                     taskDateId: 101
 *                     date: '2026-07-10'
 *                     isCompleted: true
 *                     completedAt: '2026-07-10T09:10:00+09:00'
 *       400:
 *         description: MULTI 태스크인데 taskDateId 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 다중 태스크는 taskDateId가 필요합니다.
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
 *       태스크를 삭제합니다. 삭제된 태스크 또는 회차는 복구할 수 없습니다.
 *       다중 태스크는 deleteScope로 이 항목만 삭제할지 전체 삭제할지 지정합니다.
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
 *       - name: deleteScope
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [THIS_ONLY, ALL]
 *         description: >
 *           MULTI 태스크 삭제 범위입니다.
 *           기본값은 없으며, MULTI 태스크 삭제 시 필수입니다.
 *           THIS_ONLY는 taskDateId에 해당하는 TaskDate를 삭제합니다.
 *           ALL은 미래 미완료 TaskDate만 삭제하고 과거/완료 회차는 보존합니다.
 *         example: THIS_ONLY
 *       - name: taskDateId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: MULTI 태스크에서 THIS_ONLY 삭제 시 대상 TaskDate ID
 *         example: 101
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               singleOrRange:
 *                 summary: SINGLE/RANGE 삭제 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 삭제 성공
 *                   data:
 *                     deletedCount: 1
 *               multiThisOnly:
 *                 summary: MULTI 이 항목만 삭제 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 회차 삭제 성공
 *                   data:
 *                     scope: THIS_ONLY
 *                     deletedTaskDateIds: [101]
 *                     deletedCount: 1
 *               multiAll:
 *                 summary: MULTI 전체 삭제 성공
 *                 value:
 *                   success: true
 *                   message: 태스크 회차 삭제 성공
 *                   data:
 *                     scope: ALL
 *                     deletedTaskDateIds: [102, 103]
 *                     deletedCount: 2
 *                     preservedCount: 1
 *       400:
 *         description: 삭제 범위 입력값 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               missingDeleteScope:
 *                 summary: MULTI 태스크인데 deleteScope 누락
 *                 value:
 *                   success: false
 *                   message: 다중 태스크 삭제 시 deleteScope가 필요합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               missingTaskDateId:
 *                 summary: THIS_ONLY 삭제 시 taskDateId 누락
 *                 value:
 *                   success: false
 *                   message: 이 항목만 삭제하려면 taskDateId가 필요합니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *               nonMultiWithDeleteScope:
 *                 summary: SINGLE/RANGE 태스크에 deleteScope 전달
 *                 value:
 *                   success: false
 *                   message: 다중 태스크가 아닌 경우 deleteScope를 사용할 수 없습니다.
 *                   error:
 *                     code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/tasks/:taskId', deleteTask);

export default router;