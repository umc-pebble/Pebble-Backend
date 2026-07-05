import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pebble API',
      version: '1.0.0',
      description:
        'Pebble 백엔드 API 문서. 현재는 Category / Milestone / Task / SharedCategory 도메인만 포함합니다.',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: '로컬 개발 서버',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authorization: Bearer {accessToken}',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          description: '공통 응답 포맷',
          properties: {
            code: { type: 'integer', example: 200 },
            message: { type: 'string', example: '요청 성공' },
            data: {
              type: 'object',
              nullable: true,
              description: '응답 데이터 (엔드포인트마다 형태가 다름)',
            },
          },
          required: ['code', 'message'],
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 42 },
            name: { type: 'string', maxLength: 100, example: '취업 준비' },
            color: { type: 'string', maxLength: 20, example: '#FF6B6B' },
            imageUrl: {
              type: 'string',
              maxLength: 500,
              nullable: true,
              example: 'https://storage.pebble.app/categories/1.png',
            },
            isHidden: { type: 'boolean', example: false },
            isPublic: { type: 'boolean', example: false },
            isCompleted: { type: 'boolean', example: false },
            isShared: { type: 'boolean', example: false },
            displayOrder: { type: 'integer', example: 0 },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'ISO8601 (+09:00)',
              example: '2026-07-05T10:30:00+09:00',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'ISO8601 (+09:00)',
              example: '2026-07-05T10:30:00+09:00',
            },
          },
        },
        Milestone: {
          type: 'object',
          description:
            'userId 없음 — 카테고리를 통한 2-hop 소유 판정. 날짜 유형(dateType)에 따라 startDate/endDate/repeatDays 사용 여부가 달라집니다.',
          properties: {
            id: { type: 'integer', example: 10 },
            categoryId: { type: 'integer', example: 1 },
            name: { type: 'string', maxLength: 100, example: '이력서 완성' },
            dateType: {
              type: 'string',
              enum: ['SINGLE', 'RANGE', 'REPEAT'],
              example: 'RANGE',
            },
            startDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'YYYY-MM-DD',
              example: '2026-07-01',
            },
            endDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'YYYY-MM-DD',
              example: '2026-07-31',
            },
            repeatDays: {
              type: 'string',
              maxLength: 30,
              nullable: true,
              description: 'REPEAT일 때 반복 요일 (예: MON,WED,FRI)',
              example: null,
            },
            isCompleted: { type: 'boolean', example: false },
            displayOrder: { type: 'integer', example: 0 },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
          },
        },
        Task: {
          type: 'object',
          description:
            'milestoneId=null 이면 카테고리 계층 밖 개인 인박스(단일 태스크). REPEAT 태스크의 완료/개별수정은 TaskException으로 처리합니다.',
          properties: {
            id: { type: 'integer', example: 100 },
            userId: { type: 'integer', example: 42 },
            milestoneId: {
              type: 'integer',
              nullable: true,
              description: 'null이면 단일(인박스) 태스크',
              example: 10,
            },
            name: { type: 'string', maxLength: 100, example: 'React 정리' },
            dateType: {
              type: 'string',
              enum: ['SINGLE', 'RANGE', 'REPEAT'],
              example: 'SINGLE',
            },
            startDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'YYYY-MM-DD',
              example: '2026-07-05',
            },
            endDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'YYYY-MM-DD',
              example: null,
            },
            repeatDays: {
              type: 'string',
              maxLength: 30,
              nullable: true,
              example: null,
            },
            taskTime: {
              type: 'string',
              nullable: true,
              description: 'HH:mm',
              example: '09:30',
            },
            memo: {
              type: 'string',
              nullable: true,
              example: '챕터 3까지',
            },
            color: {
              type: 'string',
              maxLength: 20,
              nullable: true,
              example: '#4ECDC4',
            },
            isCompleted: { type: 'boolean', example: false },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'ISO8601 (+09:00), 완료 시각',
              example: null,
            },
            displayOrder: { type: 'integer', example: 0 },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
          },
        },
        SharedCategoryMember: {
          type: 'object',
          description: '공유 카테고리 멤버. @@unique(categoryId, userId)',
          properties: {
            id: { type: 'integer', example: 5 },
            categoryId: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 42 },
            role: {
              type: 'string',
              enum: ['OWNER', 'MEMBER'],
              example: 'OWNER',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACCEPTED'],
              example: 'ACCEPTED',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-07-05T10:30:00+09:00',
            },
          },
        },
      },
      parameters: {
        CategoryIdPath: {
          name: 'categoryId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: '카테고리 id',
          example: 1,
        },
        MilestoneIdPath: {
          name: 'milestoneId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: '마일스톤 id',
          example: 10,
        },
        TaskIdPath: {
          name: 'taskId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: '태스크 id',
          example: 100,
        },
        MemberUserIdPath: {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: '대상 멤버의 사용자 id',
          example: 7,
        },
      },
      responses: {
        BadRequest: {
          description:
            '잘못된 요청 — 필수 필드 누락, 형식 오류(날짜 YYYY-MM-DD / 시간 HH:mm 위반), editScope=THIS_ONLY인데 originalDate 누락, REPEAT 완료 토글에 originalDate 누락 등',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: { code: 400, message: '요청 값이 올바르지 않습니다.', data: null },
            },
          },
        },
        Unauthorized: {
          description: '인증 실패 — Authorization 헤더 누락, 토큰 만료/변조',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: { code: 401, message: '유효하지 않은 토큰입니다.', data: null },
            },
          },
        },
        Forbidden: {
          description: '권한 없음 — 본인 소유 리소스가 아니거나, 공유 카테고리에서 OWNER 권한이 필요한 작업',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: { code: 403, message: '해당 작업에 대한 권한이 없습니다.', data: null },
            },
          },
        },
        NotFound: {
          description: '리소스를 찾을 수 없음 — 존재하지 않는 id이거나 이미 삭제된 리소스',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: { code: 404, message: '요청한 리소스를 찾을 수 없습니다.', data: null },
            },
          },
        },
        InternalServerError: {
          description: '서버 내부 오류',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
              example: { code: 500, message: '서버 오류가 발생했습니다.', data: null },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // 현재는 내 담당 4개 도메인 라우트만 스캔한다.
  apis: [
    './src/category/*.route.ts',
    './src/milestone/*.route.ts',
    './src/task/*.route.ts',
    './src/shared/*.route.ts',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
