import { Router } from 'express';
import { getReports, updateReportImage } from './report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateReportImageSchema } from './report.schema';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Report
 *   description: 월간 리포트. 매월 1일 전월 집계 이미지 생성·발송, 마이페이지에서 1주일 활성(PLB-027~029).
 */

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: 리포트 조회
 *     description: 마이페이지에서 조회 가능한(만료 전) 전월 리포트를 조회합니다.
 *                  리포트는 인스타 스토리 형식의 이미지로,
 *                  전월 완료 태스크 요약·가장 활성화된 카테고리·태스크가 가장 많던 날·친구 그룹일정 등을 담습니다.
 *                  발송 후 1주일 된 리포트는 만료됩니다.
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 리포트 조회 성공 / 없으면 빈 배열
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         reportMeta: { $ref: '#/components/schemas/Report' }
 *                         activityLogs: { type: object }
 *                         topCategory: { type: object, nullable: true }
 *                         busiestDay: { type: object, nullable: true }
 *                         sharedCategories:
 *                           type: array
 *                           items: { type: object }
 *       401:
 *               description: 유효하지 않은 토큰
 *               content:
 *                 application/json:
 *                   schema: { $ref: '#/components/schemas/ApiResponse' }
 *                   examples:
 *                     missingToken:
 *                       value: { success: false, message: 인증 토큰이 없습니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *                     invalidOrExpiredToken:
 *                       value: { success: false, message: 유효하지 않거나 만료된 토큰입니다., error: { code: "AUTH_TOKEN_EXPIRED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reports', getReports);

/**
 * @swagger
 * /reports/{reportId}:
 *   patch:
 *     summary: 리포트 이미지 URL 저장
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reportId
 *         in: path
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportImageUrl]
 *             properties:
 *               reportImageUrl: { type: string, format: uri, example: 'https://example.com/report-1.png' }
 *     responses:
 *       200:
 *         description: 리포트 이미지 저장 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/reports/:reportId', validateBody(updateReportImageSchema), updateReportImage);

export default router;
