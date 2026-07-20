// Auth Mailer
// 임시 비밀번호 안내 메일 발송 (PLB-035).
// TODO(#34 머지 후): 문선님이 구축한 nodemailer transporter(config/mailer.ts)로 교체한다.
// 이슈 #13에는 Resend로 적혀 있었지만, 팀 메일 스택을 nodemailer/SMTP 하나로 통일하기로 함.
// 실제 발송 연동 시 이 콘솔 로그(임시 비밀번호 노출)는 반드시 제거한다.
export const sendTempPasswordEmail = async (to: string, tempPassword: string) => {
  console.log(`[auth.mailer] 임시 비밀번호 발송 (to: ${to}): ${tempPassword}`);
};
