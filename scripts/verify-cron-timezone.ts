// 일회성 검증 스크립트 — notification.scheduler.ts가 쓰는 node-cron + { timezone: 'Asia/Seoul' }가
// 서버의 OS 타임존 설정과 무관하게 실제 KST 벽시계 기준으로 발동하는지 확인한다.
// 자정(00:10)까지 기다리는 대신, "지금부터 N분 뒤" KST 시각으로 스케줄을 걸어 같은 메커니즘을 검증한다.
// 실행: npx ts-node scripts/verify-cron-timezone.ts
import cron from 'node-cron';

function nowKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

const kstParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).formatToParts(new Date());
const hour = Number(kstParts.find((p) => p.type === 'hour')!.value);
const minute = Number(kstParts.find((p) => p.type === 'minute')!.value);

const OFFSET_MIN = 2;
let targetMinute = minute + OFFSET_MIN;
let targetHour = hour;
if (targetMinute >= 60) {
  targetMinute -= 60;
  targetHour = (targetHour + 1) % 24;
}

console.log(`[schedule] now(KST)=${nowKST()} target(KST)=${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:00`);

const task = cron.schedule(
  `${targetMinute} ${targetHour} * * *`,
  () => {
    console.log(`[FIRED] at real KST wall-clock = ${nowKST()}`);
    console.log('=== PASS: cron fired at the intended Asia/Seoul wall-clock time ===');
    task.stop();
    process.exit(0);
  },
  { timezone: 'Asia/Seoul' },
);

setTimeout(() => {
  console.log('=== FAIL: cron did not fire within timeout ===');
  process.exit(1);
}, (OFFSET_MIN + 2) * 60 * 1000);
