// 로컬 수동 테스트 전용 시드 스크립트. PR #27 (user/notification/upload) 체크리스트 검증용.
// auth 도메인(signup/login)이 아직 스텁이라 토큰을 정상 발급받을 수 없어 유저를 직접 생성하고
// jwt.sign으로 access token을 만들어 사용한다. 실행: npx ts-node scripts/seed-test-users.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import prisma from '../src/config/database';

async function main() {
  const passwordHash = await bcrypt.hash('pebble1234!', 10);

  const normalUser = await prisma.user.upsert({
    where: { email: 'test-normal@pebble.com' },
    update: {},
    create: {
      email: 'test-normal@pebble.com',
      password: passwordHash,
      nickname: '테스트유저',
      uniqueTag: '0001',
    },
  });

  const socialUser = await prisma.user.upsert({
    where: { email: 'test-social@pebble.com' },
    update: {},
    create: {
      email: 'test-social@pebble.com',
      password: null,
      nickname: '소셜유저',
      uniqueTag: '0002',
    },
  });

  const otherUser = await prisma.user.upsert({
    where: { email: 'test-other@pebble.com' },
    update: {},
    create: {
      email: 'test-other@pebble.com',
      password: passwordHash,
      nickname: '다른유저',
      uniqueTag: '0003',
    },
  });

  // 다른 유저 소유의 알림 (소유권 403 테스트용)
  const otherNotification = await prisma.notification.upsert({
    where: { id: 999001 },
    update: {},
    create: {
      id: 999001,
      userId: otherUser.id,
      type: 'FOLLOW_REQUEST',
      relatedId: normalUser.id,
    },
  });

  // normalUser 소유 알림들: 일반, 만료됨(목록에서 빠져야 함)
  const activeNotification = await prisma.notification.upsert({
    where: { id: 999002 },
    update: {},
    create: {
      id: 999002,
      userId: normalUser.id,
      type: 'FOLLOW_ACCEPTED',
      relatedId: otherUser.id,
    },
  });

  const expiredNotification = await prisma.notification.upsert({
    where: { id: 999003 },
    update: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    create: {
      id: 999003,
      userId: normalUser.id,
      type: 'REPORT',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 이미 만료됨
    },
  });

  // normalUser 소유의 FOLLOW_REQUEST (전체 삭제 시 예외로 남아야 하는지 테스트용)
  const followRequestNotification = await prisma.notification.upsert({
    where: { id: 999004 },
    update: {},
    create: {
      id: 999004,
      userId: normalUser.id,
      type: 'FOLLOW_REQUEST',
      relatedId: otherUser.id,
    },
  });

  // 페이징(offset/limit) 테스트용 알림 25개. limit 기본값(20)보다 많게 만들어야
  // 1페이지/2페이지 결과가 달라지는 걸 확인할 수 있다.
  // id를 900101~900125로 고정하고 createdAt을 1분 간격으로 벌려서 정렬 순서를 고정한다
  // (동일 createdAt이면 DB가 정렬 순서를 보장하지 않아 페이지 경계에서 결과가 흔들릴 수 있음).
  const PAGING_COUNT = 25;
  const pagingNotificationIds: number[] = [];
  for (let i = 0; i < PAGING_COUNT; i++) {
    const id = 900101 + i;
    const createdAt = new Date(Date.now() - i * 60 * 1000); // i=0이 가장 최신
    await prisma.notification.upsert({
      where: { id },
      update: { createdAt },
      create: {
        id,
        userId: normalUser.id,
        type: 'TASK_DUE',
        isRead: i % 3 === 0, // 일부는 읽음 처리해서 unreadCount도 확인 가능하게
        createdAt,
      },
    });
    pagingNotificationIds.push(id);
  }

  const sign = (userId: number) =>
    jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

  console.log('--- 테스트 유저 ---');
  console.log('normalUser id=%d email=%s accessToken=%s', normalUser.id, normalUser.email, sign(normalUser.id));
  console.log('socialUser id=%d email=%s accessToken=%s', socialUser.id, socialUser.email, sign(socialUser.id));
  console.log('otherUser  id=%d email=%s accessToken=%s', otherUser.id, otherUser.email, sign(otherUser.id));
  console.log('--- 알림 ---');
  console.log('otherNotification(다른유저 소유) id=%d', otherNotification.id);
  console.log('activeNotification(normalUser 소유, 활성) id=%d', activeNotification.id);
  console.log('expiredNotification(normalUser 소유, 만료됨) id=%d', expiredNotification.id);
  console.log(
    'followRequestNotification(normalUser 소유, 전체삭제 예외) id=%d',
    followRequestNotification.id,
  );
  console.log(
    '페이징용 알림(normalUser 소유) id=%d~%d (%d개, 최신순 정렬 기준 900101이 가장 최신)',
    pagingNotificationIds[0],
    pagingNotificationIds[pagingNotificationIds.length - 1],
    pagingNotificationIds.length,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
