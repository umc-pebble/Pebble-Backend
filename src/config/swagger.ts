import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pebble API',
      version: '1.0.0',
      description:
        'Pebble 백엔드 API 문서. Auth / User / Upload / Category / Milestone / Task / SharedCategory / Activity / Follow / Notification / Report / Subscription 도메인을 포함합니다.',
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
          description: '공통 성공 응답 포맷',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: '요청 성공' },
            data: {
              type: 'object',
              nullable: true,
              description: '응답 데이터 (엔드포인트마다 형태가 다름)',
            },
          },
          required: ['success', 'message'],
        },
        ErrorResponse: {
          type: 'object',
          description: '공통 실패 응답 포맷. error.code는 문자열 에러코드(ERROR_CODE 상수).',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: '요청 값이 올바르지 않습니다.' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'COMMON_INVALID_INPUT' },
              },
            },
          },
          required: ['success', 'message', 'error'],
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
            'userId 없음 — 카테고리를 통한 2-hop 소유 판정. 날짜 유형(dateType)에 따라 startDate/endDate 사용 여부가 달라집니다. ※ MULTIPLE(다중)는 준비 중 — 현재 저장·반환되는 값은 SINGLE/RANGE뿐입니다. (구현 예정: MULTIPLE는 선택한 날짜마다 실제 row로 존재하며 같은 seriesId를 공유)',
          properties: {
            id: { type: 'integer', example: 10 },
            categoryId: { type: 'integer', example: 1 },
            seriesId: {
              type: 'integer',
              nullable: true,
              description: '다중(MULTIPLE) 회차들이 공유하는 그룹 ID. 단일(SINGLE/RANGE) 마일스톤은 null',
              example: null,
            },
            name: { type: 'string', maxLength: 100, example: '이력서 완성' },
            dateType: {
              type: 'string',
              enum: ['SINGLE', 'RANGE', 'MULTIPLE'],
              description: '현재 SINGLE/RANGE만 사용됨. MULTIPLE는 준비 중',
              example: 'RANGE',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'YYYY-MM-DD (항상 존재). MULTIPLE 회차 row에서는 해당 회차의 날짜',
              example: '2026-07-01',
            },
            endDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'YYYY-MM-DD. RANGE 전용 — SINGLE/MULTIPLE에서는 null',
              example: '2026-07-31',
            },
            isCompleted: { type: 'boolean', description: '회차 row별 독립 기록', example: false },
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
        GrassDay: {
          type: 'object',
          description:
            '징검다리(활동기록) 일별 통계. ERD의 ActivityLog 한 행에 대응 (UK: userId+date). ' +
            'level은 DB에 저장하지 않고 완료 수로 계산하는 값 (PLB-023: 0개=0(빈 칸), 1~2개=1, 3~4개=2, 5개 이상=3).',
          properties: {
            date: {
              type: 'string',
              format: 'date',
              description: 'YYYY-MM-DD (KST 0시~23:59 기준)',
              example: '2026-06-30',
            },
            completedTaskCount: {
              type: 'integer',
              description: '해당 날짜에 완료한 태스크 수 (PLB-022: 마일스톤·카테고리는 카운트하지 않음)',
              example: 5,
            },
            level: {
              type: 'integer',
              enum: [0, 1, 2, 3],
              description: '진하기 단계 — 0개: 0 / 1~2개: 1 / 3~4개: 2 / 5개 이상: 3',
              example: 3,
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
        UserPublicProfile: {
          type: 'object',
          description:
            '회원 식별·프로필 공통 필드. UserProfile·User 스키마가 공유하는 기반 스키마로, 단독으로는 API 응답에 쓰이지 않는다.',
          properties: {
            id: { type: 'integer', example: 42 },
            email: { type: 'string', format: 'email', example: 'pebble@umc.com' },
            nickname: { type: 'string', maxLength: 100, example: '조약돌' },
            uniqueTag: {
              type: 'string',
              maxLength: 10,
              description: '닉네임#태그 식별자 (친구 검색용)',
              example: '0417',
            },
            profileImageUrl: { type: 'string', maxLength: 500, nullable: true, example: null },
            bio: { type: 'string', nullable: true, example: '한 걸음씩' },
            lastNicknameChangedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: '마지막 닉네임 변경 시각 (15일 쿨다운 계산용, PLB-043)',
              example: null,
            },
            nicknameChangableAfter: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: '닉네임 재변경 가능 시각 (lastNicknameChangedAt + 15일, 서버 계산값, FE 표시용)',
              example: null,
            },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
          },
        },
        UserProfile: {
          description:
            '프로필 조회/편집 응답 전용 스키마. 테마·알림·징검다리 색상 등 설정값은 포함하지 않으며, 해당 값은 GET/PATCH /users/me/settings에서 다룬다.',
          allOf: [{ $ref: '#/components/schemas/UserPublicProfile' }],
        },
        User: {
          description: '회원 공개 정보. password·refreshToken 등 민감 필드는 응답에서 제외.',
          allOf: [
            { $ref: '#/components/schemas/UserPublicProfile' },
            {
              type: 'object',
              properties: {
                activityColor: {
                  type: 'string',
                  maxLength: 20,
                  description: '징검다리 색상 (팔레트 내 선택, PLB-026)',
                  example: '#7ED321',
                },
                notifyTaskDue: { type: 'boolean', description: '당일/마감 알림 on/off', example: true },
                theme: { type: 'string', enum: ['LIGHT', 'DARK'], example: 'LIGHT' },
                isTempPassword: {
                  type: 'boolean',
                  description: '임시 비밀번호 상태 (재설정 직후 true, 변경 유도)',
                  example: false,
                },
                updatedAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
              },
            },
          ],
        },
        UserProfileSummary: {
          type: 'object',
          description:
            'PATCH /users/me 등 부분 수정 응답에서 사용하는 프로필 요약. 전체 프로필은 UserProfile(GET /users/me) 참고.',
          properties: {
            id: { type: 'integer', example: 1 },
            nickname: { type: 'string', example: 'newName' },
            uniqueTag: { type: 'string', example: '1234' },
            bio: { type: 'string', nullable: true, example: '새 소개글' },
            profileImageUrl: { type: 'string', nullable: true, example: 'https://supabase.../new.jpg' },
            lastNicknameChangedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2026-07-06T00:00:00+09:00',
            },
          },
        },
        AuthTokens: {
          type: 'object',
          description: '로그인/토큰 재발급 응답. accessToken은 Authorization Bearer로 사용, refreshToken으로 재발급.',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni.access...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni.refresh...' },
          },
        },
        SocialAccount: {
          type: 'object',
          description: '소셜 로그인 연동 정보. @@unique(provider, providerAccountId)',
          properties: {
            id: { type: 'integer', example: 3 },
            userId: { type: 'integer', example: 42 },
            provider: { type: 'string', enum: ['google', 'naver'], example: 'google' },
            providerAccountId: { type: 'string', maxLength: 255, example: '109876543210987654321' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
          },
        },
        Follow: {
          type: 'object',
          description:
            '팔로우 관계. @@unique(followerId, followingId), 자기 자신 불가. 요청 → 수락 승인제이며 row 하나로 양방향 관계 표현 — 수락(ACCEPTED) 시 상호 열람 가능한 친구(PLB-033·034·041).',
          properties: {
            id: { type: 'integer', example: 15 },
            followerId: { type: 'integer', description: '팔로우 요청자', example: 42 },
            followingId: { type: 'integer', description: '팔로우 대상', example: 7 },
            status: { type: 'string', enum: ['PENDING', 'ACCEPTED'], example: 'PENDING' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
            updatedAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
          },
        },
        Notification: {
          type: 'object',
          description:
            '인앱 알림. relatedId는 type별로 가리키는 대상이 달라 FK가 아님. 최대 30일 보관 후 자동 삭제(PLB-038).',
          properties: {
            id: { type: 'integer', example: 88 },
            userId: { type: 'integer', example: 42 },
            type: {
              type: 'string',
              enum: [
                'FOLLOW_REQUEST',
                'FOLLOW_ACCEPTED',
                'TASK_DUE',
                'MILESTONE_DUE',
                'REPORT',
                'CATEGORY_INVITE',
                'CATEGORY_DELETED',
                'CATEGORY_ACCEPTED',
              ],
              example: 'FOLLOW_REQUEST',
            },
            relatedId: {
              type: 'integer',
              nullable: true,
              description: 'type별 관련 리소스 id (FK 아님)',
              example: 15,
            },
            isRead: { type: 'boolean', example: false },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: '자동 삭제 예정 시각',
              example: '2026-08-04T10:30:00+09:00',
            },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-05T10:30:00+09:00' },
          },
        },
        Report: {
          type: 'object',
          description: '월간 리포트. 매월 1일 전월 집계 이미지 생성·발송, 발송 후 1주일 활성(PLB-027~029).',
          properties: {
            id: { type: 'integer', example: 4 },
            userId: { type: 'integer', example: 42 },
            month: { type: 'string', maxLength: 7, description: 'YYYY-MM', example: '2026-06' },
            reportImageUrl: {
              type: 'string',
              maxLength: 500,
              example: 'https://storage.pebble.app/reports/42-2026-06.png',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: '자동 삭제 일시 (발송 후 1주일)',
              example: '2026-07-08T00:00:00+09:00',
            },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00+09:00' },
          },
        },
        Subscription: {
          type: 'object',
          description: '구독(애플 IAP). 결제 이력 보존을 위해 User 1:N Subscription.',
          properties: {
            id: { type: 'integer', example: 2 },
            userId: { type: 'integer', example: 42 },
            status: { type: 'string', enum: ['ACTIVE', 'CANCELED', 'EXPIRED'], example: 'ACTIVE' },
            originalTransactionId: {
              type: 'string',
              maxLength: 255,
              nullable: true,
              description: '애플 IAP 원본 트랜잭션 ID',
              example: '1000000123456789',
            },
            startDate: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00+09:00' },
            endDate: { type: 'string', format: 'date-time', example: '2026-08-01T00:00:00+09:00' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00+09:00' },
            updatedAt: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00+09:00' },
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
            '잘못된 요청 — 필수 필드 누락, 형식 오류(날짜 YYYY-MM-DD / 시간 HH:mm 위반), 허용되지 않는 파라미터 조합 등. 세부 사유는 각 엔드포인트의 400 설명 참고',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: '요청 값이 올바르지 않습니다.', error: { code: 'COMMON_INVALID_INPUT' } },
            },
          },
        },
        Unauthorized: {
          description: '인증 실패 — Authorization 헤더 누락, 토큰 만료/변조',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: '유효하지 않은 토큰입니다.', error: { code: 'COMMON_UNAUTHORIZED' } },
            },
          },
        },
        Forbidden: {
          description: '권한 없음 — 본인 소유 리소스가 아니거나, 공유 카테고리에서 OWNER 권한이 필요한 작업',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: '해당 작업에 대한 권한이 없습니다.', error: { code: 'COMMON_FORBIDDEN' } },
            },
          },
        },
        NotFound: {
          description: '리소스를 찾을 수 없음 — 존재하지 않는 id이거나 이미 삭제된 리소스',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: '요청한 리소스를 찾을 수 없습니다.', error: { code: 'COMMON_NOT_FOUND' } },
            },
          },
        },
        InternalServerError: {
          description: '서버 내부 오류',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: '서버 오류가 발생했습니다.', error: { code: 'COMMON_INTERNAL_ERROR' } },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // 전 도메인 라우트의 JSDoc을 스캔한다.
  apis: [
    './src/category/*.route.ts',
    './src/milestone/*.route.ts',
    './src/task/*.route.ts',
    './src/shared/*.route.ts',
    './src/activity/*.route.ts',
    './src/auth/*.route.ts',
    './src/user/*.route.ts',
    './src/upload/*.route.ts',
    './src/follow/*.route.ts',
    './src/notification/*.route.ts',
    './src/report/*.route.ts',
    './src/subscription/*.route.ts',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
