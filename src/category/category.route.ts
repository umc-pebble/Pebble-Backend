import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  listCategoriesQuerySchema,
} from './category.schema';
import {
  getCategories,
  getFriendCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from './category.controller';

const router = Router();

// 카테고리 API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
// 경로 한정 필수: 모든 라우터가 /api/v1에 공유 마운트되므로, 경로 없는 use()는
// 뒤에 마운트된 다른 도메인(auth 공개 엔드포인트 등)까지 전부 막아버린다.
router.use('/categories', authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Category
 *   description: 카테고리 (여정의 최상위 계층)
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: 카테고리 목록 조회 (PLB-010·011)
 *     description: >
 *       로그인한 회원의 카테고리 목록을 조회합니다.
 *       userId는 JWT에서 추출하며 별도 파라미터가 없습니다.
 *       본인 소유 카테고리뿐 아니라, 초대를 수락(ACCEPTED)한 공유 카테고리도 함께 포함됩니다.
 *       정렬은 본인 소유 카테고리(displayOrder 오름차순)가 먼저 오고, 공유받은 카테고리가 그 뒤에 옵니다.
 *       displayOrder는 카테고리 오너 기준으로 채번되는 순번이라 오너가 다르면 값이 겹칠 수 있어,
 *       두 구간을 나눠 정렬합니다. 순서 변경(PATCH /categories/order)의 대상도 본인 소유 카테고리뿐입니다.
 *
 *
 *       각 카테고리에는 월과 무관한 일정 집계(milestoneCount·taskCount·sharedTaskCount·hasSchedules)가
 *       함께 내려갑니다. 월별 조회(GET /tasks, GET /milestones)는 해당 월로 걸러진 결과만 주기 때문에
 *       "이번 달에만 일정이 없는 카테고리"와 "월별 조회에 아예 나타나지 않는 카테고리"가 똑같이
 *       빈 결과로 보이는데, 이 값들로 두 경우를 구분할 수 있습니다.
 *       사이드바 노출 판정 예시 — hasSchedules=false면 표시,
 *       hasSchedules=true인데 해당 월 일정이 없으면 숨김.
 *
 *
 *       집계 기준이 필드마다 다릅니다. taskCount는 "요청자 본인이 만든 태스크"만 세는데,
 *       GET /tasks가 같은 기준으로 거르기 때문입니다(기준이 어긋나면 어느 달에도 보이지 않는
 *       카테고리가 영구히 숨겨집니다). 공유 카테고리에서 다른 멤버가 만든 태스크는 아직 월별 조회에
 *       포함되지 않으므로 sharedTaskCount로 분리해 두었고, hasSchedules에도 합산되지 않습니다.
 *       마일스톤은 userId 없이 카테고리로 권한이 정해져 milestoneCount가 곧 접근 가능한 전체 개수입니다.
 *
 *
 *       주의 — hasSchedules=false는 "이 카테고리에 일정이 전혀 없다"가 아니라
 *       "요청자의 월별 조회에는 어느 달에도 나타나지 않는다"는 뜻입니다.
 *       공유 카테고리에서 다른 멤버가 만든 태스크만 있는 경우(sharedTaskCount > 0)가 여기에 해당하며,
 *       이때도 hasSchedules는 false입니다. 사이드바에서는 빈 카테고리와 동일하게 표시되는데,
 *       어차피 요청자의 월별 화면에는 아무것도 뜨지 않으므로 화면상 모순은 없습니다.
 *
 *
 *       owned·isCompleted 쿼리로 조회 범위를 좁힐 수 있습니다. 둘 다 생략하면 위 설명대로
 *       소유 카테고리와 수락한 공유 카테고리를 모두 반환합니다(사이드바 용도).
 *       마이페이지의 "완료한 카테고리"는 오너 본인에게만 노출되어야 하므로
 *       owned=true&isCompleted=true로 조회하세요. 공유 멤버로 참여 중인 카테고리는 제외됩니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: owned
 *         required: false
 *         schema:
 *           type: boolean
 *         description: >
 *           true면 본인이 오너인 카테고리만, false면 공유받은 카테고리만 반환합니다.
 *           생략하면 둘 다 반환합니다.
 *       - in: query
 *         name: isCompleted
 *         required: false
 *         schema:
 *           type: boolean
 *         description: 완료 여부로 거릅니다. 생략하면 완료·미완료를 모두 반환합니다.
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
 *                         categories:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Category'
 *             example:
 *               success: true
 *               message: 카테고리 조회 성공
 *               data:
 *                 categories:
 *                   - id: 1
 *                     name: 학교
 *                     color: '#FF6B6B'
 *                     imageUrl: null
 *                     isCompleted: false
 *                     isHidden: false
 *                     isPublic: true
 *                     isShared: false
 *                     displayOrder: 0
 *                     milestoneCount: 2
 *                     taskCount: 5
 *                     sharedTaskCount: 0
 *                     hasSchedules: true
 *                   - id: 2
 *                     name: 새 카테고리
 *                     color: '#4ECDC4'
 *                     imageUrl: null
 *                     isCompleted: false
 *                     isHidden: false
 *                     isPublic: false
 *                     isShared: false
 *                     displayOrder: 1
 *                     milestoneCount: 0
 *                     taskCount: 0
 *                     sharedTaskCount: 0
 *                     hasSchedules: false
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/categories', validateQuery(listCategoriesQuerySchema), getCategories);

/**
 * @swagger
 * /categories/order:
 *   patch:
 *     summary: 카테고리 순서 변경 (PLB-011)
 *     description: 드래그 앤 드롭으로 변경된 카테고리 순서를 일괄 갱신합니다. 화면에 보이는 순서대로 categoryId를 나열해 전달합니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
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
 *                 description: 화면 순서대로 나열한 categoryId 배열
 *                 example: [3, 1, 5, 2]
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
 *         description: 존재하지 않는 ID 또는 본인 소유가 아닌 ID 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 존재하지 않는 카테고리 ID가 포함되어 있습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/categories/order', validateBody(reorderCategoriesSchema), reorderCategories);

/**
 * @swagger
 * /categories/{categoryId}:
 *   get:
 *     summary: 카테고리 단건 조회
 *     description: |
 *       카테고리 단건 상세를 조회합니다. 오너뿐 아니라 초대를 수락한 공유 멤버도 조회할 수 있습니다.
 *
 *       상세 화면의 진행률 표시를 위해 taskTotalCount·taskCompletedCount·progressRate를 함께 내려줍니다.
 *       이 세 필드는 태스크만 집계하며 마일스톤은 포함하지 않습니다. 조회한 달과 무관하게 카테고리 전체가 기준입니다.
 *       다중(MULTIPLE) 태스크는 날짜별 회차를 각각 1개로 세고, 회차마다 완료 여부를 따로 판단합니다.
 *       작성자를 가리지 않고 카테고리에 남아 있는 태스크를 모두 세므로 오너와 공유 멤버에게 같은 값이 내려갑니다.
 *     tags: [Category]
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
 *                       $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/categories/:categoryId', getCategory);

/**
 * @swagger
 * /users/{userId}/categories:
 *   get:
 *     summary: 친구 카테고리 목록 조회 (#64·PLB-040)
 *     description: >
 *       친구(수락된 팔로우) 또는 본인의 공개 카테고리 목록을 화면 표시 순서(displayOrder 오름차순, 사용자가 드래그로 재정렬한 순서가 반영됨)로 조회합니다.
 *       공개(isPublic=true)로 설정된 카테고리만 노출되며, 비공개 카테고리는 포함되지 않습니다.
 *       친구가 아닌 유저의 프로필은 조회할 수 없습니다(403).
 *
 *       **대상 유저가 소유한 카테고리뿐 아니라, 대상 유저가 멤버로 참여 중인 공유 카테고리도 함께 내려갑니다.**
 *       친구가 남의 공유 카테고리에만 일정을 쓰고 있으면 소유 카테고리만 볼 때 프로필이 비어 보이기 때문입니다.
 *       이때 응답의 userId는 대상 유저가 아니라 그 공유 카테고리의 오너를 가리키므로,
 *       "친구 소유"와 "친구가 참여 중"을 구분해야 한다면 userId와 경로의 userId를 비교하면 됩니다(isShared도 함께 참고).
 *
 *       공유 카테고리에는 **대상 유저가 그 카테고리에 마일스톤이나 태스크를 하나라도 작성했어야 한다**는
 *       조건이 붙습니다. 아무것도 쓰지 않은 카테고리까지 내려가면 일정은 없이 남의 카테고리 이름과 색만
 *       노출되기 때문입니다. 이 판정은 조회 월과 무관하게 전체 기간 기준이므로, 목록에 있어도 특정 월에는
 *       비어 보일 수 있습니다. (대상 유저가 소유한 카테고리는 비어 있어도 그대로 노출됩니다 — 기존 동작 유지)
 *
 *       카테고리 오너가 요청자와 친구인지는 보지 않습니다. 친구 태스크 조회(`GET /tasks/users/{userId}`)가
 *       같은 범위를 오너 관계 없이 열기 때문에, 목록만 좁히면 목록에 없는 카테고리의 태스크가 내려가
 *       이름도 색도 알 수 없는 항목을 받게 됩니다. 목록은 내용 조회의 상위집합이어야 합니다.
 *
 *       정렬은 대상 유저 소유 카테고리를 먼저, 참여 중인 공유 카테고리를 그 뒤에 둡니다.
 *       displayOrder가 오너 기준 순번이라 오너가 다른 카테고리를 한 줄로 섞으면 순번이 겹치기 때문입니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 카테고리를 조회할 대상 사용자 ID
 *         example: 2
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
 *                         categories:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Category'
 *             example:
 *               success: true
 *               message: 카테고리 목록 조회 성공
 *               data:
 *                 categories:
 *                   - id: 12
 *                     name: 학교
 *                     color: '#FF6B6B'
 *                     imageUrl: null
 *                     isCompleted: false
 *                     isHidden: false
 *                     isPublic: true
 *                     isShared: false
 *                     displayOrder: 0
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
 *         description: 유저를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 유저를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users/:userId/categories', authMiddleware, getFriendCategories);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: 카테고리 생성 (PLB-007)
 *     description: >
 *       카테고리를 생성합니다. 이름과 색상은 필수이며, 둘 다 중복 생성이 가능합니다.
 *       대표 이미지는 선택 사항으로, 미첨부 시 기본 이미지로 대체됩니다(비율 3:4).
 *       카테고리 기간은 설정하지 않습니다. 생성 시 기본 상태는 "미완료"이나,
 *       이미 끝난 일정을 소급 기입하는 경우 isCompleted=true로 완료 상태로도 생성할 수 있습니다(PLB-007).
 *       이름은 텍스트·특수문자·이모티콘(단일) 지정이 가능하지만 공백 단일은 불가능합니다.
 *       inviteUserIds를 1명 이상 지정하면 생성과 동시에 공유 카테고리로 전환됩니다 (PLB-044) — 요청자는
 *       OWNER(ACCEPTED), 초대 대상은 MEMBER(PENDING)로 등록되고 isShared=true가 됩니다.
 *       팔로잉 관계가 아닌 유저가 포함되어 있는 등 초대 검증에 하나라도 실패하면 카테고리 생성 자체가
 *       롤백됩니다(all-or-nothing, POST /categories/{categoryId}/share와 동일한 방식). 한 번에 최대
 *       50명까지 초대할 수 있습니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, color]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 공백 단일 불가. 텍스트·특수문자·이모티콘 가능, 중복 허용
 *                 example: 학교
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 description: HEX 색상 코드
 *                 example: '#FF6B6B'
 *               imageUrl:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 description: 대표 이미지 URL. 미첨부(null) 시 기본 이미지로 대체
 *                 example: null
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *                 description: 공개 설정 (PLB-040). 생성 모달의 공개 토글 값. 미전송 시 비공개(false)로 생성
 *               isCompleted:
 *                 type: boolean
 *                 default: false
 *                 description: 완료 상태로 생성 (PLB-007). 미전송 시 미완료(false). 이미 끝난 일정을 소급 기입할 때만 true
 *               inviteUserIds:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: integer
 *                 description: '함께 초대할 팔로잉 친구 id 목록 (최대 50명), 예: [7, 8]. 1명 이상 지정 시 공유 카테고리로 생성됩니다. 빈 배열([])은 무시되고 일반 카테고리로 생성됩니다.'
 *                 example: null
 *     responses:
 *       201:
 *         description: >
 *           카테고리 생성 성공. data.category에 생성된 카테고리가 담깁니다.
 *           inviteUserIds를 1명 이상 지정한 경우 data.members에 생성된 SharedCategoryMember 목록(오너 1 + 초대 멤버 N)이 함께 담깁니다.
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
 *                         category:
 *                           $ref: '#/components/schemas/Category'
 *                         members:
 *                           type: array
 *                           description: inviteUserIds를 1명 이상 지정했을 때만 포함됩니다.
 *                           items:
 *                             $ref: '#/components/schemas/SharedCategoryMember'
 *             example:
 *               success: true
 *               message: 카테고리 생성 성공
 *               data:
 *                 category:
 *                   id: 5
 *                   name: 학교
 *                   color: '#FF6B6B'
 *                   isPublic: false
 *                   isCompleted: false
 *                   isShared: false
 *                   displayOrder: 3
 *       400:
 *         description: 입력값 오류(이름 공백 단일, 필수 필드 누락 등), 또는 초대 대상 중 팔로잉 관계가 아닌 유저 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               invalidInput:
 *                 summary: 이름 공백 단일
 *                 value: { success: false, message: 카테고리 이름은 공백만으로 지정할 수 없습니다., error: { code: "COMMON_INVALID_INPUT" } }
 *               notFriend:
 *                 summary: 팔로잉 관계가 아닌 유저 포함
 *                 value: { success: false, message: 팔로잉 관계가 아닌 유저는 초대할 수 없습니다., error: { code: "CATEGORY_NOT_FRIEND" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: inviteUserIds에 존재하지 않는 유저 id 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 대상 유저를 찾을 수 없습니다.
 *               error:
 *                 code: COMMON_NOT_FOUND
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories', validateBody(createCategorySchema), createCategory);

/**
 * @swagger
 * /categories/{categoryId}:
 *   patch:
 *     summary: 카테고리 수정 (PLB-008·040)
 *     description: >
 *       카테고리 이름·색상·대표 이미지·완료 여부·공개 설정을 수정합니다. 전달된 필드만 부분 수정됩니다.
 *       색상 변경 시 하위 마일스톤·태스크의 계열 색상에도 영향을 줍니다.
 *       imageUrl에 null을 보내면 대표 이미지가 삭제되고 기본 이미지로 대체됩니다.
 *       비공개(isPublic=false)로 설정하면 팔로잉 유저 화면에서 카테고리-마일스톤-태스크가 모두 노출되지 않습니다.
 *       공유 카테고리의 경우 오너뿐 아니라 초대를 수락(ACCEPTED)한 멤버도 동등하게 수정할 수 있습니다 (PLB-045).
 *       단 isPublic(팔로워 공개 여부)과 isHidden(화면 숨김)은 오너만 변경할 수 있습니다(멤버가 보내면 403) —
 *       카테고리 내용이 아니라 오너 개인의 설정이고, 값이 카테고리에 하나만 저장되어 멤버가 바꾸면
 *       오너의 공개 범위·화면에 그대로 반영되기 때문입니다.
 *     tags: [Category]
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
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: 변경할 이름
 *               color:
 *                 type: string
 *                 maxLength: 20
 *                 description: 변경 시 하위 마일스톤·태스크 계열색에 영향
 *               imageUrl:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 description: null 전달 시 기본 이미지로 대체
 *               isCompleted:
 *                 type: boolean
 *                 description: 완료/미완료 토글
 *               isPublic:
 *                 type: boolean
 *                 description: 공개/비공개 설정 (PLB-040)
 *               isHidden:
 *                 type: boolean
 *                 description: 캘린더에서 숨김 처리 (하위 마일스톤·태스크도 함께 숨겨짐)
 *           example:
 *             name: 학교 (졸업)
 *             isCompleted: true
 *             isPublic: false
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
 *                       $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/categories/:categoryId', validateBody(updateCategorySchema), updateCategory);

/**
 * @swagger
 * /categories/{categoryId}:
 *   delete:
 *     summary: 카테고리 삭제 (PLB-009)
 *     description: >
 *       카테고리를 삭제합니다. 하위 마일스톤·태스크(및 TaskException, SharedCategoryMember)가
 *       함께 삭제(CASCADE)되며 복구할 수 없습니다.
 *       삭제 확인(카테고리 이름 입력 모달)은 프론트엔드에서 처리합니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryIdPath'
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: 카테고리 삭제 성공
 *               data: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/categories/:categoryId', deleteCategory);

export default router;
