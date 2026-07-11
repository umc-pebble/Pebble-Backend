import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from './category.controller';

const router = Router();

// 카테고리 API는 모두 로그인 필요(bearerAuth). authMiddleware가 req.userId를 채운다.
router.use(authMiddleware);

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
 *       로그인한 회원의 카테고리 목록을 생성순(displayOrder 오름차순)으로 조회합니다.
 *       userId는 JWT에서 추출하며 별도 파라미터가 없습니다.
 *     tags: [Category]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/categories', getCategories);

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
router.patch('/categories/order', reorderCategories);

/**
 * @swagger
 * /categories/{categoryId}:
 *   get:
 *     summary: 카테고리 단건 조회
 *     description: 카테고리 단건 상세를 조회합니다.
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
 * /categories:
 *   post:
 *     summary: 카테고리 생성 (PLB-007)
 *     description: >
 *       카테고리를 생성합니다. 이름과 색상은 필수이며, 둘 다 중복 생성이 가능합니다.
 *       대표 이미지는 선택 사항으로, 미첨부 시 기본 이미지로 대체됩니다(비율 3:4).
 *       카테고리 기간은 설정하지 않습니다. 생성 시 기본 상태는 "미완료"이나,
 *       이미 끝난 일정을 소급 기입하는 경우 isCompleted=true로 완료 상태로도 생성할 수 있습니다(PLB-007).
 *       이름은 텍스트·특수문자·이모티콘(단일) 지정이 가능하지만 공백 단일은 불가능합니다.
 *       inviteUserIds에 팔로잉 친구를 담아 보내면 생성과 동시에 공유 카테고리로 만들어집니다
 *       (요청자 OWNER, 초대자 PENDING 등록, isShared=true — 공유 전환 /categories/{id}/share와 동일 로직).
 *       초대 처리 중 일부가 실패해도 카테고리 생성 자체는 정상 처리되며, 초대 결과는 응답 data.invites로 반환됩니다(부분 성공).
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
 *                 description: '함께 초대할 팔로잉 친구 id 목록. 지정 시 공유 카테고리로 생성(isShared=true), 초대자는 PENDING 등록. 팔로잉 관계가 아닌 유저는 실패로 처리되나 생성은 정상 진행 (예: [7, 8])'
 *                 example: null
 *     responses:
 *       201:
 *         description: >
 *           카테고리 생성 성공. data.category에 생성된 카테고리가 담깁니다.
 *           inviteUserIds를 보낸 경우에만 data.invites에 초대 결과(부분 성공)가 포함되고,
 *           초대를 보내지 않았으면 invites는 생략됩니다.
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
 *                         invites:
 *                           type: object
 *                           nullable: true
 *                           description: inviteUserIds를 보낸 경우에만 포함되는 초대 처리 결과
 *                           properties:
 *                             succeeded:
 *                               type: array
 *                               items:
 *                                 type: integer
 *                               description: 초대 성공(PENDING 등록)한 userId 목록
 *                             failed:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   userId:
 *                                     type: integer
 *                                   reason:
 *                                     type: string
 *                                     description: '실패 사유 (예: NOT_FOLLOWING, NOT_FOUND, ALREADY_MEMBER)'
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
 *                   isShared: true
 *                   displayOrder: 3
 *                 invites:
 *                   succeeded: [7]
 *                   failed:
 *                     - userId: 9
 *                       reason: NOT_FOLLOWING
 *       400:
 *         description: 입력값 오류 (이름 공백 단일, 필수 필드 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: 카테고리 이름은 공백만으로 지정할 수 없습니다.

 *               error:

 *                 code: COMMON_INVALID_INPUT
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/categories', createCategory);

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
router.patch('/categories/:categoryId', updateCategory);

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
