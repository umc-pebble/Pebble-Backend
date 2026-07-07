import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from './category.controller';

const router = Router();

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
 *               code: 200
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
 *               code: 200
 *               message: 순서 변경 성공
 *               data: {}
 *       400:
 *         description: 존재하지 않는 ID 또는 본인 소유가 아닌 ID 포함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 400
 *               message: 존재하지 않는 카테고리 ID가 포함되어 있습니다.
 *               data: null
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
 *       카테고리 기간은 설정하지 않으며, 생성 시 기본 상태는 "미완료"입니다.
 *       이름은 텍스트·특수문자·이모티콘(단일) 지정이 가능하지만 공백 단일은 불가능합니다.
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
 *     responses:
 *       201:
 *         description: 카테고리 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Category'
 *             example:
 *               code: 201
 *               message: 카테고리 생성 성공
 *               data:
 *                 id: 5
 *                 name: 학교
 *                 color: '#FF6B6B'
 *                 displayOrder: 3
 *       400:
 *         description: 입력값 오류 (이름 공백 단일, 필수 필드 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               code: 400
 *               message: 카테고리 이름은 공백만으로 지정할 수 없습니다.
 *               data: null
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
 *               code: 200
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
