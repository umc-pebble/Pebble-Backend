import transporter from '../config/mailer';

export const sendEmailChangeVerification = async (to: string, token: string) => {
  const link = `${process.env.APP_BASE_URL ?? 'https://pebble.app'}/email/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? 'noreply@pebble.app',
    to,
    subject: '[Pebble] 이메일 변경 인증',
    html: `<p>아래 링크를 눌러 이메일 변경을 완료해주세요. 링크는 1시간 동안 유효합니다.</p><p><a href="${link}">${link}</a></p>`,
  });
};
