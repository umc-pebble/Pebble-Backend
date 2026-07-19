import nodemailer from 'nodemailer';

// SMTP_PORT 465는 SMTPS(암시적 TLS), 그 외(587 등)는 STARTTLS를 쓴다.
// port를 한 번만 파싱해 secure 판정에도 그대로 재사용한다 (별도 문자열 비교 시
// 공백·개행 등으로 SMTP_PORT 원본 문자열과 어긋날 수 있음).
const port = Number(process.env.SMTP_PORT ?? 587);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`SMTP_PORT는 1~65535 사이의 정수여야 합니다: ${process.env.SMTP_PORT}`);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  // secure: false는 STARTTLS를 시도만 할 뿐 서버가 지원 안 하면 평문으로 진행될 수 있다.
  // 465(암시적 TLS) 외 포트는 STARTTLS를 강제해 자격증명·토큰이 평문으로 새지 않게 한다.
  requireTLS: port !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export default transporter;
