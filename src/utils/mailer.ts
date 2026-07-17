import nodemailer from 'nodemailer';

// SMTP_PORT 465는 SMTPS(암시적 TLS), 그 외(587 등)는 STARTTLS를 쓴다.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmailChangeVerification = async (to: string, token: string) => {
  const link = `${process.env.APP_BASE_URL ?? 'https://pebble.app'}/email/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: '[Pebble] 이메일 변경 인증',
    html: `<p>아래 링크를 눌러 이메일 변경을 완료해주세요. 링크는 1시간 동안 유효합니다.</p><p><a href="${link}">${link}</a></p>`,
  });
};
