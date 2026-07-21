import transporter from '../config/mailer';

// Auth Mailer
// 임시 비밀번호 안내 메일 발송 (PLB-035).
// 이슈 #13에는 Resend로 적혀 있었지만, 이메일 변경 인증(utils/mailer.ts)이 이미 nodemailer/SMTP로
// 구축돼 있어 메일 스택을 하나로 통일했다.
// 발송이 실패하면 예외를 그대로 던져 authService가 이전 비밀번호로 원복하게 한다.
// 임시 비밀번호는 자격 증명이므로 로그에 남기지 않는다.
export const sendTempPasswordEmail = async (to: string, tempPassword: string) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? 'noreply@pebble.app',
    to,
    subject: '[Pebble] 임시 비밀번호 안내',
    html:
      `<p>요청하신 임시 비밀번호는 <b>${tempPassword}</b> 입니다.</p>` +
      `<p>임시 비밀번호로 로그인한 뒤 새 비밀번호로 변경해주세요.</p>`,
  });
};
