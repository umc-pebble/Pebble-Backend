import { Router } from 'express';
import { getReports, getReportByMonth, downloadReport } from './report.controller';

const router = Router();

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
 *     summary: 리포트 목록 조회 (PLB-028)
 *     description: 마이페이지에서 조회 가능한(만료 전) 월간 리포트 목록을 최신순으로 조회합니다.
 *     tags: [Report]
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
 *                         reports:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Report' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reports', getReports);

/**
 * @swagger
 * /reports/{month}:
 *   get:
 *     summary: 월별 리포트 조회 (PLB-028)
 *     description: >
 *       특정 월(YYYY-MM)의 리포트를 조회합니다. 리포트는 인스타 스토리 형식의 GIF로,
 *       전월 완료 태스크 요약·가장 활성화된 카테고리·태스크가 가장 많던 날·친구 그룹일정 등을 담습니다.
 *       만료(발송 후 1주일)되었거나 존재하지 않으면 404입니다.
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: month
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: 대상 월 (YYYY-MM)
 *         example: '2026-06'
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
 *                     data: { $ref: '#/components/schemas/Report' }
 *       400:
 *         description: month 형식 오류(YYYY-MM 아님)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: month는 YYYY-MM 형식이어야 합니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 해당 월 리포트 없음 또는 만료됨
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 리포트를 찾을 수 없습니다., error: { code: "COMMON_NOT_FOUND" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reports/:month', getReportByMonth);

/**
 * @swagger
 * /reports/{reportId}/download:
 *   post:
 *     summary: 리포트 다운로드(저장) (PLB-029)
 *     description: >
 *       특정 리포트를 다운로드합니다. 리포트는 인스타 스토리 형식의 이미지로,
 *       전월 완료 태스크 요약·가장 활성화된 카테고리·태스크가 가장 많던 날·친구 그룹일정 등을 담습니다.
 *       만료(발송 후 1주일)되었거나 존재하지 않으면 404입니다.
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reportId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: 대상 리포트 ID
 *         example: 'report_123'
 *     responses:
 *       200:
 *         description: 다운로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Report' }
 *       400:
 *         description: reportId 형식 오류
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: reportId는 유효한 형식이어야 합니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 해당 리포트 없음 또는 만료됨
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 리포트를 찾을 수 없습니다., error: { code: "COMMON_NOT_FOUND" } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reports/{reportId}/download', downloadReport);

export default router;
