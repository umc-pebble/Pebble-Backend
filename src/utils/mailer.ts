// 메일 발송 유틸.
// TODO: 실제 SMTP/이메일 서비스(nodemailer 등) 연동 전까지는 콘솔 로그로 대체한다.
// 토큰 발급·검증 로직은 실제 구현이므로, 이 함수만 실제 발송 로직으로 교체하면 된다.
export const sendEmailChangeVerification = async (to: string, token: string) => {
  const link = `${process.env.APP_BASE_URL ?? 'https://pebble.app'}/email/verify?token=${token}`;
  console.log(`[mailer] 이메일 변경 인증 링크 발송 (to: ${to}): ${link}`);
};
