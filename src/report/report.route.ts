import { Router } from 'express';
import { getReports } from './report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

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
 *         description: 리포트 조회 성공
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
 *                         reports:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Report' }
 *       404:
 *               description: 해당 월 리포트 없음 또는 만료됨
 *               content:
 *                 application/json:
 *                   schema: { $ref: '#/components/schemas/ApiResponse' }
 *                   example: { success: false, message: 리포트를 찾을 수 없습니다., error: { code: "COMMON_NOT_FOUND" } }
 *       401:
 *               description: 유효하지 않은 토큰
 *               content:
 *                 application/json:
 *                   schema: { $ref: '#/components/schemas/ApiResponse' }
 *                   example: { success: false, message: 유효하지 않은 토큰입니다., error: { code: "COMMON_UNAUTHORIZED" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reports', getReports);

export default router;
