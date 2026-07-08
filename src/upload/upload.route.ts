import { Router } from 'express';
import { uploadImage } from './upload.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: 이미지 업로드. Supabase Storage에 저장 후 공개 URL을 반환하며, 반환된 URL을 각 리소스 컬럼에 저장한다.
 */

/**
 * @swagger
 * /uploads/image:
 *   post:
 *     summary: 이미지 업로드 (PLB-004·007·037)
 *     description: >
 *       프로필/카테고리 대표 이미지를 업로드합니다. multipart/form-data의 image 필드로 전송하며,
 *       JPEG·PNG·WEBP만 허용하고 최대 5MB로 제한합니다.
 *       파일명은 서버에서 UUID/타임스탬프로 변환해 저장(덮어쓰기 방지)하고, 업로드 성공 시 공개 URL을 반환합니다.
 *       이 URL을 프로필/카테고리 수정 API의 imageUrl 필드에 담아 저장합니다.
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 이미지 파일 (JPEG/PNG/WEBP, 최대 5MB)
 *     responses:
 *       201:
 *         description: 업로드 성공
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
 *                         imageUrl:
 *                           type: string
 *                           example: https://storage.pebble.app/uploads/9f3a1c2e.png
 *             example:
 *               success: true
 *               message: 이미지 업로드 성공
 *               data:
 *                 imageUrl: https://storage.pebble.app/uploads/9f3a1c2e.png
 *       400:
 *         description: 파일 크기 초과(5MB) 또는 허용되지 않은 형식
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *             example: { success: false, message: 허용되지 않은 파일 형식이거나 크기가 너무 큽니다., error: { code: "COMMON_INVALID_INPUT" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/uploads/image', uploadImage);

export default router;
