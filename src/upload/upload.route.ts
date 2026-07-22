import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadSingleImage } from '../middlewares/upload.middleware';
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
 *       프로필/카테고리 대표 이미지를 업로드합니다. multipart/form-data의 file 필드로 전송하며,
 *       JPEG·PNG·WEBP만 허용하고 최대 5MB로 제한합니다.
 *       파일명은 서버에서 UUID로 변환해 저장(덮어쓰기 방지)하고, 업로드 성공 시 공개 URL을 반환합니다.
 *       이 URL을 프로필(PATCH /users/me의 profileImageUrl)·카테고리 대표 이미지 등 각 리소스 필드에 담아 전송합니다.
 *       업로드 실패 시 기존 이미지(또는 기본 이미지)는 그대로 유지되며 변경사항은 저장되지 않습니다.
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 이미지 파일 (JPEG/PNG/WEBP, 최대 5MB)
 *     responses:
 *       200:
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
 *             examples:
 *               sizeExceeded:
 *                 summary: 5MB 초과
 *                 value: { success: false, message: 업로드 가능한 최대 용량(5MB)을 초과했습니다., error: { code: "FILE_SIZE_EXCEEDED" } }
 *               typeNotAllowed:
 *                 summary: 허용되지 않은 파일 형식
 *                 value: { success: false, message: JPEG/PNG/WEBP 형식만 업로드할 수 있습니다., error: { code: "FILE_TYPE_NOT_ALLOWED" } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/uploads/image', authMiddleware, uploadSingleImage, uploadImage);

export default router;
